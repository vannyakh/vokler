from pydantic import BaseModel, Field, HttpUrl


class PreviewRequest(BaseModel):
    url: HttpUrl | str = Field(..., description="Video or stream URL")


class MediaFormatRow(BaseModel):
    format_id: str
    ext: str
    resolution: str
    fps: float | None = None
    filesize: int | None = None
    vcodec: str | None = None
    acodec: str | None = None
    format_note: str | None = None
    tbr: float | None = None


class PreviewResponse(BaseModel):
    title: str | None
    duration_seconds: int | None
    duration_label: str | None
    uploader: str | None
    thumbnail: str | None
    webpage_url: str | None
    recommended_format: str | None = None
    formats: list[MediaFormatRow]
