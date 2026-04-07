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


class BundleItem(BaseModel):
    url: str
    title: str
    thumbnail: str | None = None
    duration_seconds: int | None = None
    duration_label: str | None = None


class BundlePreviewResponse(PreviewResponse):
    """First video’s formats plus all flat playlist / tab entries for UI rows."""

    bundle_title: str | None = None
    bundle_items: list[BundleItem] = Field(default_factory=list)
