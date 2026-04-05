from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from app.models.job import JobStatus
from app.services.downloader import ALLOWED_FORMAT_KEYS, default_format_key


class ArchiveCreate(BaseModel):
    """Either ``urls`` (explicit list) or ``url`` + ``expand_flat`` (playlist / channel / profile)."""

    urls: list[str] | None = None
    url: HttpUrl | str | None = None
    expand_flat: bool = False
    format: str = Field(
        default_factory=default_format_key,
        description="Preset key or raw yt-dlp format string from /preview",
    )
    label: str | None = Field(default=None, description="Display name for the ZIP (optional)")

    @field_validator("format")
    @classmethod
    def format_ok(cls, v: str) -> str:
        key = (v or "").strip() or default_format_key()
        if key in ALLOWED_FORMAT_KEYS:
            return key
        if len(key) > 500:
            raise ValueError("Format selector too long")
        return key

    @model_validator(mode="after")
    def urls_or_expand(self) -> ArchiveCreate:
        if self.expand_flat:
            u = str(self.url or "").strip()
            if not u:
                raise ValueError("url is required when expand_flat is true")
            if self.urls:
                raise ValueError("omit urls when using expand_flat with url")
        else:
            if not self.urls:
                raise ValueError("urls is required when expand_flat is false")
            cleaned = [str(x).strip() for x in self.urls if str(x).strip()]
            if not cleaned:
                raise ValueError("at least one URL is required")
            self.urls = cleaned
        return self


class ArchivePublic(BaseModel):
    id: UUID
    status: JobStatus
    progress: float
    error_message: str | None
    download_format: str
    label: str | None
    source_urls: list[str]
    total_items: int
    current_index: int
    result_path: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
