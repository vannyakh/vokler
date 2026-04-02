"""yt-dlp download pipeline (video/audio formats, FFmpeg post-processors)."""

from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any, Callable

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
