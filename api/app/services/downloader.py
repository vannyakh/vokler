"""yt-dlp download pipeline (video/audio formats, FFmpeg post-processors)."""

from __future__ import annotations

import asyncio
import logging
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse, urlunparse

import yt_dlp
from yt_dlp.utils import DownloadError

logger = logging.getLogger(__name__)

FORMAT_MAP: dict[str, str] = {
    "mp4_1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio/best[height<=1080]",
    "mp4_720p": "bestvideo[height<=720][ext=mp4]+bestaudio/best[height<=720]",
    "mp4_480p": "bestvideo[height<=480][ext=mp4]+bestaudio/best",
    "mp3_320": "bestaudio/best",
    "mp3_192": "bestaudio/best",
    "original": "best",
}

POSTPROCESSORS: dict[str, list[dict[str, Any]]] = {
    "mp3_320": [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "320",
        },
    ],
    "mp3_192": [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        },
    ],
}

ALLOWED_FORMAT_KEYS: frozenset[str] = frozenset(FORMAT_MAP.keys())


def default_format_key() -> str:
    return "original"


def _format_duration_label(seconds: int | float | None) -> str | None:
    if seconds is None:
        return None
    sec = int(seconds)
    m, s = divmod(sec, 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _resolution_label(f: dict[str, Any]) -> str:
    w, h = f.get("width"), f.get("height")
    if w and h:
        return f"{w}×{h}"
    if h:
        return f"{h}p"
    vc = (f.get("vcodec") or "").lower()
    if vc in ("none", ""):
        return "Audio only"
    return "—"


def _build_format_rows(info: dict[str, Any], limit: int = 48) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for f in info.get("formats") or []:
        fid = f.get("format_id")
        if fid is None:
            continue
        sid = str(fid)
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        rows.append(
            {
                "format_id": sid,
                "ext": str(f.get("ext") or ""),
                "resolution": _resolution_label(f),
                "fps": f.get("fps"),
                "filesize": f.get("filesize") or f.get("filesize_approx"),
                "vcodec": f.get("vcodec"),
                "acodec": f.get("acodec"),
                "format_note": f.get("format_note"),
                "tbr": f.get("tbr"),
            },
        )

    def sort_key(r: dict[str, Any]) -> tuple[int, int]:
        fs = r.get("filesize") or 0
        h = 0
        res = r.get("resolution") or ""
        if "×" in res:
            try:
                h = int(res.split("×")[-1].replace("p", ""))
            except ValueError:
                h = 0
        elif res.endswith("p"):
            try:
                h = int(res[:-1])
            except ValueError:
                h = 0
        return (-h, -fs)

    rows.sort(key=sort_key)
    return rows[:limit]


def extract_preview_sync(url: str) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not isinstance(info, dict):
                raise RuntimeError("Unexpected extractor response")
    except (DownloadError, OSError, ValueError) as e:
        raise RuntimeError(str(e) or "Failed to read media info") from e

    formats = _build_format_rows(info)
    dur = info.get("duration")
    return {
        "title": info.get("title"),
        "duration_seconds": int(dur) if dur is not None else None,
        "duration_label": _format_duration_label(dur),
        "uploader": info.get("uploader") or info.get("channel"),
        "thumbnail": info.get("thumbnail") or (info.get("thumbnails") or [{}])[-1].get("url"),
        "webpage_url": info.get("webpage_url") or info.get("original_url") or url,
        "recommended_format": str(info.get("format_id")) if info.get("format_id") else None,
        "formats": formats,
    }


async def extract_preview(url: str) -> dict[str, Any]:
    return await asyncio.to_thread(extract_preview_sync, url)


def normalize_youtube_bundle_url(url: str) -> str:
    """
    yt-dlp ``extract_flat`` on ``watch?v=…&list=…`` returns a single video (``entries`` is
    ``None``). Use the canonical playlist URL so the full list is expanded.
    Handles ``youtu.be/VIDEO?list=…`` the same way.
    """
    raw = (url or "").strip()
    if not raw:
        return raw
    try:
        parsed = urlparse(raw)
    except ValueError:
        return raw
    host = (parsed.netloc or "").lower()
    if host.endswith(":443"):
        host = host[:-4]
    host = host.split("@")[-1]
    if "youtube.com" not in host and not re.fullmatch(r"(?:[\w-]+\.)?youtu\.be", host):
        return raw
    qs = parse_qs(parsed.query, keep_blank_values=False)
    list_vals = qs.get("list") or []
    list_id = (list_vals[0] or "").strip() if list_vals else ""
    if not list_id:
        return raw

    segments = [seg for seg in parsed.path.split("/") if seg]
    is_watch = bool(segments and segments[0] == "watch")
    is_shorts = bool(segments and segments[0] == "shorts")
    is_youtu_be = bool(re.fullmatch(r"(?:[\w-]+\.)?youtu\.be", host))
    has_v = bool(qs.get("v"))

    if is_youtu_be or (is_watch and has_v) or is_shorts:
        return f"https://www.youtube.com/playlist?list={list_id}"
    return raw


def normalize_youtube_flat_source_url(url: str) -> str:
    """
    Speed up yt-dlp ``extract_flat`` for channel-style URLs.

    Resolving ``/@handle`` (channel home) is much slower than the **Videos** tab; normalize so we
    only walk the uploads feed (same cap as ``max_entries`` via ``playlistend``).
    """
    u = (url or "").strip()
    if not u:
        return u
    try:
        parsed = urlparse(u)
    except ValueError:
        return u
    host = (parsed.netloc or "").lower()
    if host.endswith(":443"):
        host = host[:-4]
    if "youtube.com" not in host:
        return u

    path = parsed.path or ""
    # /channel/UC… → /channel/UC…/videos
    m = re.match(r"^/(channel/[^/]+)/?$", path, re.IGNORECASE)
    if m:
        base = m.group(1)
        new_path = f"/{base}/videos"
        return urlunparse((parsed.scheme, parsed.netloc, new_path, "", parsed.query, parsed.fragment))

    # /@handle or /@handle/ → /@handle/videos
    m = re.match(r"^/(@[^/]+)/?$", path)
    if m:
        handle = m.group(1)
        new_path = f"/{handle}/videos"
        return urlunparse((parsed.scheme, parsed.netloc, new_path, "", parsed.query, parsed.fragment))

    return u


def _normalize_for_flat_extract(url: str) -> str:
    return normalize_youtube_flat_source_url(normalize_youtube_bundle_url(url))


def _entry_dict_to_url(entry: dict[str, Any]) -> str | None:
    u = entry.get("url") or entry.get("webpage_url")
    if u:
        return str(u).strip()
    eid = entry.get("id")
    ie = (entry.get("ie_key") or "").lower()
    if eid and "youtube" in ie:
        return f"https://www.youtube.com/watch?v={eid}"
    return None


def extract_flat_urls_sync(url: str, max_entries: int = 100) -> tuple[list[str], str | None]:
    """
    List video URLs from a playlist, channel tab, or multi-video page (``extract_flat``).
    For a single video, returns a one-element list.
    """
    url = _normalize_for_flat_extract(url)
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
        "ignoreerrors": True,
        "playlistend": max_entries,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not isinstance(info, dict):
            raise RuntimeError("Unexpected extractor response")
    except (DownloadError, OSError, ValueError) as e:
        raise RuntimeError(str(e) or "Failed to list media URLs") from e

    title = (
        info.get("playlist_title")
        or info.get("title")
        or info.get("uploader")
        or info.get("channel")
    )
    entries = info.get("entries")
    if not entries:
        main = info.get("webpage_url") or info.get("original_url") or url
        return ([str(main).strip()], title if isinstance(title, str) else None)

    urls: list[str] = []
    for e in entries:
        if len(urls) >= max_entries:
            break
        if isinstance(e, str):
            u = e.strip()
            if u:
                urls.append(u)
            continue
        if e is None or not isinstance(e, dict):
            continue
        u = _entry_dict_to_url(e)
        if u:
            urls.append(u)
    if not urls:
        main = info.get("webpage_url") or info.get("original_url") or url
        return ([str(main).strip()], title if isinstance(title, str) else None)
    return (urls, title if isinstance(title, str) else None)


async def extract_flat_urls(url: str, max_entries: int = 100) -> tuple[list[str], str | None]:
    return await asyncio.to_thread(extract_flat_urls_sync, url, max_entries)


def _entry_thumbnail(entry: dict[str, Any]) -> str | None:
    thumbs = entry.get("thumbnails")
    if isinstance(thumbs, list) and thumbs:
        last = thumbs[-1]
        if isinstance(last, dict):
            u = last.get("url")
            if u:
                return str(u).strip()
    t = entry.get("thumbnail")
    if t:
        return str(t).strip()
    eid = entry.get("id")
    ie = (entry.get("ie_key") or "").lower()
    if eid and "youtube" in ie:
        return f"https://i.ytimg.com/vi/{eid}/hqdefault.jpg"
    return None


def _bundle_title_from_info(info: dict[str, Any]) -> str | None:
    t = (
        info.get("playlist_title")
        or info.get("title")
        or info.get("uploader")
        or info.get("channel")
    )
    return str(t).strip() if isinstance(t, str) and t.strip() else None


def extract_flat_entries_sync(url: str, max_entries: int = 100) -> tuple[list[dict[str, Any]], str | None]:
    """
    Flat playlist / tab / profile listing with per-row metadata for UI.
    """
    url = _normalize_for_flat_extract(url)
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
        "ignoreerrors": True,
        "playlistend": max_entries,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not isinstance(info, dict):
            raise RuntimeError("Unexpected extractor response")
    except (DownloadError, OSError, ValueError) as e:
        raise RuntimeError(str(e) or "Failed to list media URLs") from e

    title_hint = _bundle_title_from_info(info)
    entries = info.get("entries")

    def row_from_video_info(v: dict[str, Any], fallback_url: str) -> dict[str, Any]:
        u = _entry_dict_to_url(v) or str(
            v.get("webpage_url") or v.get("original_url") or fallback_url,
        ).strip()
        dur = v.get("duration")
        title = v.get("title") or v.get("id") or "Video"
        return {
            "url": u,
            "title": str(title),
            "thumbnail": _entry_thumbnail(v),
            "duration_seconds": int(dur) if dur is not None else None,
            "duration_label": _format_duration_label(dur),
        }

    if not entries:
        main = str(info.get("webpage_url") or info.get("original_url") or url).strip()
        return ([row_from_video_info(info, main)], title_hint)

    rows: list[dict[str, Any]] = []
    for e in entries:
        if len(rows) >= max_entries:
            break
        if isinstance(e, str):
            u = e.strip()
            if u:
                rows.append(
                    {
                        "url": u,
                        "title": "Video",
                        "thumbnail": None,
                        "duration_seconds": None,
                        "duration_label": None,
                    },
                )
            continue
        if e is None or not isinstance(e, dict):
            continue
        u = _entry_dict_to_url(e)
        if not u:
            continue
        dur = e.get("duration")
        rows.append(
            {
                "url": u,
                "title": str(e.get("title") or e.get("id") or "Video"),
                "thumbnail": _entry_thumbnail(e),
                "duration_seconds": int(dur) if dur is not None else None,
                "duration_label": _format_duration_label(dur),
            },
        )

    if not rows:
        main = str(info.get("webpage_url") or info.get("original_url") or url).strip()
        return ([row_from_video_info(info, main)], title_hint)
    return (rows, title_hint)


async def extract_flat_entries(url: str, max_entries: int = 100) -> tuple[list[dict[str, Any]], str | None]:
    return await asyncio.to_thread(extract_flat_entries_sync, url, max_entries)


def _resolve_output_path(tmp_dir: Path, info: dict[str, Any]) -> Path:
    fp = info.get("filepath")
    if fp:
        path = Path(fp)
        if path.is_file():
            return path
    prepared = info.get("_filename")
    if prepared:
        path = Path(prepared)
        if path.is_file():
            return path
    files = [p for p in tmp_dir.rglob("*") if p.is_file()]
    if not files:
        raise RuntimeError("yt-dlp produced no output file")
    return max(files, key=lambda p: p.stat().st_mtime)


class YtDlpDownloader:
    def __init__(
        self,
        format_selector: str,
        progress_hook: Callable[[dict[str, Any]], None] | None = None,
    ):
        self.format_selector = (format_selector or default_format_key()).strip()
        self.progress_hook = progress_hook

    def _format_merge_and_postprocessors(
        self,
    ) -> tuple[str, list[dict[str, Any]], bool]:
        sel = self.format_selector
        if sel in FORMAT_MAP:
            return (
                FORMAT_MAP[sel],
                list(POSTPROCESSORS.get(sel, [])),
                sel.startswith("mp4_"),
            )
        return sel, [], False

    def download_sync(self, url: str) -> tuple[Path, dict[str, Any], Path]:
        """Download to a temp directory. Caller must delete ``tmp_dir`` after copying the file."""
        tmp_dir = Path(tempfile.mkdtemp(prefix="vokler_"))
        out_tmpl = str(tmp_dir / "%(title)s.%(ext)s")
        spec, postprocessors, merge_mp4 = self._format_merge_and_postprocessors()
        ydl_opts: dict[str, Any] = {
            "format": spec,
            "outtmpl": out_tmpl,
            "quiet": True,
            "no_warnings": True,
            "restrictfilenames": True,
            "noprogress": True,
            "postprocessors": postprocessors,
            "noplaylist": True,
        }
        if merge_mp4:
            ydl_opts["merge_output_format"] = "mp4"
        if self.progress_hook is not None:
            ydl_opts["progress_hooks"] = [self.progress_hook]

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if not isinstance(info, dict):
                    raise RuntimeError("Unexpected extractor response")
                out_path = _resolve_output_path(tmp_dir, info)
                metadata = {
                    "title": info.get("title"),
                    "thumbnail": info.get("thumbnail"),
                    "duration": info.get("duration"),
                    "uploader": info.get("uploader"),
                    "filesize": info.get("filesize") or info.get("filesize_approx"),
                }
            return out_path, metadata, tmp_dir
        except (DownloadError, OSError, ValueError) as e:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise RuntimeError(str(e) or "yt-dlp download failed") from e
        except Exception:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise

    async def download(self, url: str) -> tuple[Path, dict[str, Any], Path]:
        return await asyncio.to_thread(self.download_sync, url)
