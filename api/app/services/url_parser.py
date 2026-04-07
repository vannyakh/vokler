import re
from enum import StrEnum
from urllib.parse import parse_qs, urlparse

_URL_PATTERNS: list[tuple[StrEnum, re.Pattern[str]]] = []


class Platform(StrEnum):
    YOUTUBE = "youtube"
    TWITCH = "twitch"
    TIKTOK = "tiktok"
    GENERIC = "generic"


_PATTERN_DEFS: list[tuple[Platform, str]] = [
    (Platform.YOUTUBE, r"(?:youtube\.com|youtu\.be)"),
    (Platform.TWITCH, r"twitch\.tv"),
    (Platform.TIKTOK, r"tiktok\.com"),
]

for platform, pat in _PATTERN_DEFS:
    _URL_PATTERNS.append((platform, re.compile(pat, re.IGNORECASE)))


def detect_platform(url: str) -> Platform:
    """Return host-derived platform hint for yt-dlp extractor selection."""
    for platform, rx in _URL_PATTERNS:
        if rx.search(url):
            return platform
    return Platform.GENERIC


def url_suggests_youtube_bundle_preview(url: str) -> bool:
    """
    YouTube URLs that must use ``extract_flat`` for a useful preview.

    A plain ``extract_preview`` with ``noplaylist`` on a *playlist* or *tab* URL returns
    container metadata only (often **empty formats**). When ``PreviewRequest.type`` is
    omitted, we route these to the bundle path so the API returns ``bundle_items`` + formats.

    ``watch?v=VIDEO&list=RD…`` (mix / radio) still targets one video; use the single-video
    path so ``noplaylist`` preview works. Only treat ``list=`` as bundle when there is no
    explicit video id on the URL.
    """
    raw = (url or "").strip()
    if not raw:
        return False
    try:
        parsed = urlparse(raw)
    except ValueError:
        return False
    host = (parsed.netloc or "").lower()
    if host.endswith(":443"):
        host = host[:-4]
    if "youtube.com" not in host and "youtu.be" not in host:
        return False

    segments = [seg for seg in parsed.path.split("/") if seg]
    path = (parsed.path or "").rstrip("/").lower()
    is_watch = bool(segments and segments[0] == "watch")
    is_shorts = bool(len(segments) >= 2 and segments[0] == "shorts")
    is_youtu_be = "youtu.be" in host

    qs = parse_qs(parsed.query, keep_blank_values=False)
    list_vals = [x.strip() for x in qs.get("list", []) if (x or "").strip()]
    v_vals = [x.strip() for x in qs.get("v", []) if (x or "").strip()]

    if list_vals:
        if is_watch and v_vals:
            return False
        if is_youtu_be and segments:
            return False
        if is_shorts:
            return False
        return True

    if "playlist" in path:
        return True

    for suffix in ("/videos", "/shorts", "/streams", "/live"):
        if path.endswith(suffix):
            return True
    return False
