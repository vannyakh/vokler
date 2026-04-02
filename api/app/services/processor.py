"""FFmpeg-based audio extract and quality selection."""

from __future__ import annotations

import asyncio
import shutil
from pathlib import Path


class FFmpegNotFoundError(RuntimeError):
    pass


async def ensure_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise FFmpegNotFoundError("ffmpeg not found on PATH")
    return path


async def extract_audio(
    input_path: Path,
    output_path: Path,
    codec: str = "libmp3lame",
    bitrate: str = "192k",
) -> None:
    """Mux/transcode to target audio file (e.g. MP3)."""
    ffmpeg = await ensure_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    proc = await asyncio.create_subprocess_exec(
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-acodec",
        codec,
        "-b:a",
        bitrate,
        str(output_path),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(err.decode() or "ffmpeg failed")
