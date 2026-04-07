from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.job import JobStatus
from app.services.downloader import ALLOWED_FORMAT_KEYS, default_format_key


class DownloadCreate(BaseModel):
    url: HttpUrl | str = Field(..., description="Video or stream URL")
    format: str = Field(
        default_factory=default_format_key,
        description="Preset key (mp4_720p, original, …) or raw yt-dlp format string from /preview",
    )

    @field_validator("format")
    @classmethod
    def format_ok(cls, v: str) -> str:
        key = (v or "").strip() or default_format_key()
        if key in ALLOWED_FORMAT_KEYS:
            return key
        if len(key) > 500:
            raise ValueError("Format selector too long")
        return key


class JobFileDownloadLink(BaseModel):
    """How the browser should obtain the file (avoids fetch→302 to R2 CORS failures)."""

    mode: Literal["redirect", "blob"]
    url: str


class JobPublic(BaseModel):
    id: UUID
    url: str
    platform: str | None
    download_format: str
    status: JobStatus
    progress: float
    error_message: str | None
    result_path: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
