import re
from enum import StrEnum

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
