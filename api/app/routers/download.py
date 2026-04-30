import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from arq import create_pool
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_optional_user_id
from app.models.archive import ArchiveJob
from app.models.job import DownloadJob, JobStatus
from app.schemas.archive import ArchiveCreate, ArchivePublic
from app.schemas.job import DownloadCreate, JobFileDownloadLink, JobPublic
from app.schemas.preview import (
    BundleItem,
    BundlePreviewResponse,
    MediaFormatRow,
    PreviewRequest,
    PreviewResponse,
)
from app.services.downloader import extract_flat_entries, extract_flat_urls, extract_preview
from app.services.storage import parse_s3_uri, presigned_get_url_async
from app.services.url_parser import detect_platform, url_suggests_youtube_bundle_preview

router = APIRouter()
logger = logging.getLogger(__name__)


def _resolve_artifact_file(result_path: str, storage_root: Path) -> Path | None:
    """Resolve DB ``result_path`` to a file under ``storage_root`` (handles relative cwd paths)."""
    storage_root = storage_root.resolve()
    rp = (result_path or "").strip()
    if not rp:
        return None
    raw = Path(rp)
    candidates: list[Path] = []
    try:
        if raw.is_absolute():
            candidates.append(raw.resolve())
        else:
            candidates.append((Path.cwd() / raw).resolve())
            candidates.append((storage_root / raw).resolve())
    except OSError:
        return None
    seen: set[str] = set()
    for path in candidates:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        try:
            path.relative_to(storage_root)
        except ValueError:
            continue
        if path.is_file():
            return path
    return None


async def _enqueue_download(job_id: UUID) -> None:
    pool = await create_pool(settings.arq_redis_settings)
    try:
        await pool.enqueue_job("run_download_job", str(job_id))
    finally:
        await pool.close()


async def _enqueue_archive(archive_id: UUID) -> None:
    pool = await create_pool(settings.arq_redis_settings)
    try:
        await pool.enqueue_job("run_archive_job", str(archive_id))
    finally:
        await pool.close()


async def _remote_artifact_url(
    result_path: str,
    *,
    log_id: UUID,
    log_kind: str,
) -> str | None:
    """HTTPS public URL or presigned S3 URL, or ``None`` if the artifact is only on local disk."""
    rp = (result_path or "").strip()
    if rp.startswith("https://") or rp.startswith("http://"):
        return rp
    parsed = parse_s3_uri(rp)
    if parsed is None:
        return None
    bucket, key = parsed
    try:
        return await presigned_get_url_async(bucket, key)
    except Exception as e:
        logger.warning("presigned URL failed %s_id=%s: %s", log_kind, log_id, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate download link",
        ) from e


async def _artifact_response_from_result_path(
    result_path: str,
    *,
    log_id: UUID,
    log_kind: str,
) -> FileResponse | RedirectResponse:
    """Serve local file, redirect to HTTPS, or presign S3 — shared by single jobs and archive ZIPs."""
    rp = (result_path or "").strip()
    remote = await _remote_artifact_url(rp, log_id=log_id, log_kind=log_kind)
    if remote is not None:
        return RedirectResponse(url=remote, status_code=status.HTTP_302_FOUND)

    base = Path(settings.local_storage_path).resolve()
    path = _resolve_artifact_file(rp, base)
    if path is None:
        logger.warning(
            "artifact missing %s_id=%s result_path=%s storage_root=%s cwd=%s",
            log_kind,
            log_id,
            rp,
            base,
            Path.cwd(),
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File missing on disk",
        )
    return FileResponse(
        path,
        filename=path.name,
        media_type="application/octet-stream",
    )


async def _bundle_preview_response(url: str) -> BundlePreviewResponse:
    """Playlist / channel / profile: list all entries + format table from the first video."""
    try:
        items_raw, bundle_title = await extract_flat_entries(url)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    if not items_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No videos found for this URL",
        )
    last_err: str | None = None
    data: dict[str, Any] | None = None
    for row in items_raw[: min(8, len(items_raw))]:
        one = str(row.get("url") or "").strip()
        if not one:
            continue
        try:
            data = await extract_preview(one)
        except RuntimeError as e:
            last_err = str(e) or "Failed to read media info"
            data = None
            continue
        last_err = None
        break
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=last_err or "Failed to load format list for this playlist",
        )
    format_rows = data.pop("formats")
    formats = [MediaFormatRow.model_validate(f) for f in format_rows]
    bundle_items = [BundleItem.model_validate(x) for x in items_raw]
    return BundlePreviewResponse(
        bundle_title=bundle_title,
        bundle_items=bundle_items,
        **data,
        formats=formats,
    )


def _use_bundle_preview(body: PreviewRequest, url: str) -> bool:
    """Explicit ``playlist`` / ``profile``, or YouTube playlist/tab URLs when ``type`` is omitted."""
    if body.type in ("playlist", "profile"):
        return True
    if body.type == "video":
        return False
    return url_suggests_youtube_bundle_preview(url)


@router.post("/preview", response_model=BundlePreviewResponse)
async def preview_media(body: PreviewRequest):
    """Single video by default; use ``type`` or YouTube URL shape to get ``bundle_items`` + formats."""
    url = str(body.url).strip()
    if _use_bundle_preview(body, url):
        return await _bundle_preview_response(url)
    try:
        data = await extract_preview(url)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    format_rows = data.pop("formats")
    formats = [MediaFormatRow.model_validate(f) for f in format_rows]
    base = PreviewResponse(**data, formats=formats)
    dumped = base.model_dump()
    return BundlePreviewResponse(
        bundle_title=None,
        bundle_items=[],
        **dumped,
    )


@router.post("/preview/bundle", response_model=BundlePreviewResponse)
async def preview_bundle(body: PreviewRequest):
    """Backward-compatible alias; prefer ``POST /preview`` with ``type``: ``playlist`` or ``profile``."""
    url = str(body.url).strip()
    return await _bundle_preview_response(url)


@router.post("/download", response_model=JobPublic, status_code=status.HTTP_202_ACCEPTED)
async def create_download(
    body: DownloadCreate,
    user_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    url = str(body.url).strip()
    platform = detect_platform(url).value
    job = DownloadJob(
        user_id=user_id,
        url=url,
        platform=platform,
        download_format=body.format,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    try:
        await _enqueue_download(job.id)
    except Exception as e:
        # Redis/arq can raise more than OSError; job row is already committed.
        logger.warning("Could not enqueue job %s: %s", job.id, e)
    return JobPublic.model_validate(job)


def _is_completed(job: DownloadJob) -> bool:
    s = job.status
    if isinstance(s, JobStatus):
        return s == JobStatus.COMPLETED
    if isinstance(s, str):
        return s == "completed"
    v = getattr(s, "value", None)
    if isinstance(v, str):
        return v == "completed"
    return False


async def _job_file_response(
    job_id: UUID,
    requester_id: UUID | None,
    db: AsyncSession,
) -> FileResponse | RedirectResponse:
    job = await db.scalar(select(DownloadJob).where(DownloadJob.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.user_id is not None and requester_id != job.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _is_completed(job) or not job.result_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File not ready or download failed",
        )
    return await _artifact_response_from_result_path(
        job.result_path,
        log_id=job_id,
        log_kind="job",
    )


# Short path (recommended): avoids nesting under POST /download in some proxies.
@router.get("/files/{job_id}")
async def download_job_file_short(
    job_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Serve the finished file for browser download."""
    return await _job_file_response(job_id, requester_id, db)


@router.get("/files/{job_id}/download-link", response_model=JobFileDownloadLink)
async def job_file_download_link(
    job_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return how to download without ``fetch`` following a cross-origin 302 (R2 CORS)."""
    job = await db.scalar(select(DownloadJob).where(DownloadJob.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.user_id is not None and requester_id != job.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _is_completed(job) or not job.result_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File not ready or download failed",
        )
    rp = (job.result_path or "").strip()
    remote = await _remote_artifact_url(rp, log_id=job_id, log_kind="job")
    if remote is not None:
        return JobFileDownloadLink(mode="redirect", url=remote)
    return JobFileDownloadLink(mode="blob", url=f"/files/{job_id}")


@router.get("/download/files/{job_id}")
async def download_job_file_primary(
    job_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Alias of ``GET /files/{job_id}``."""
    return await _job_file_response(job_id, requester_id, db)


@router.get("/jobs/{job_id}/file")
async def download_job_file_legacy(
    job_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Alias for ``GET /download/files/{job_id}``."""
    return await _job_file_response(job_id, requester_id, db)


@router.get("/jobs/{job_id}", response_model=JobPublic)
async def get_job(
    job_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    job = await db.scalar(select(DownloadJob).where(DownloadJob.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.user_id is not None and requester_id != job.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobPublic.model_validate(job)


def _is_archive_completed(aj: ArchiveJob) -> bool:
    s = aj.status
    if isinstance(s, JobStatus):
        return s == JobStatus.COMPLETED
    if isinstance(s, str):
        return s == "completed"
    v = getattr(s, "value", None)
    if isinstance(v, str):
        return v == "completed"
    return False


@router.post("/download/archive", response_model=ArchivePublic, status_code=status.HTTP_202_ACCEPTED)
async def create_archive_download(
    body: ArchiveCreate,
    user_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    if body.expand_flat:
        try:
            urls, title_hint = await extract_flat_urls(str(body.url))
        except RuntimeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        label = (body.label or title_hint or "").strip() or None
    else:
        urls = list(body.urls or [])
        label = (body.label or "").strip() or None

    if len(urls) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many items (max 100 per archive)",
        )

    aj = ArchiveJob(
        user_id=user_id,
        status=JobStatus.PENDING,
        progress=0.0,
        download_format=body.format,
        label=label[:512] if label else None,
        source_urls=urls,
        total_items=len(urls),
        current_index=0,
    )
    db.add(aj)
    await db.commit()
    await db.refresh(aj)
    try:
        await _enqueue_archive(aj.id)
    except Exception as e:
        logger.warning("Could not enqueue archive %s: %s", aj.id, e)
    return ArchivePublic.model_validate(aj)


@router.get("/archive/{archive_id}", response_model=ArchivePublic)
async def get_archive_job(
    archive_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    aj = await db.scalar(select(ArchiveJob).where(ArchiveJob.id == archive_id))
    if not aj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive not found")
    if aj.user_id is not None and requester_id != aj.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive not found")
    return ArchivePublic.model_validate(aj)


async def _archive_file_response(
    archive_id: UUID,
    requester_id: UUID | None,
    db: AsyncSession,
) -> FileResponse | RedirectResponse:
    aj = await db.scalar(select(ArchiveJob).where(ArchiveJob.id == archive_id))
    if not aj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive not found")
    if aj.user_id is not None and requester_id != aj.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive not found")
    if not _is_archive_completed(aj) or not aj.result_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archive not ready or build failed",
        )
    return await _artifact_response_from_result_path(
        aj.result_path,
        log_id=archive_id,
        log_kind="archive",
    )


@router.get("/files/archive/{archive_id}")
async def download_archive_file_short(
    archive_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Download the finished ZIP for a batch / playlist / profile job."""
    return await _archive_file_response(archive_id, requester_id, db)


@router.get("/files/archive/{archive_id}/download-link", response_model=JobFileDownloadLink)
async def archive_file_download_link(
    archive_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Like ``GET /files/{job_id}/download-link`` but for archive ZIPs."""
    aj = await db.scalar(select(ArchiveJob).where(ArchiveJob.id == archive_id))
    if not aj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive not found")
    if aj.user_id is not None and requester_id != aj.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive not found")
    if not _is_archive_completed(aj) or not aj.result_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archive not ready or build failed",
        )
    rp = (aj.result_path or "").strip()
    remote = await _remote_artifact_url(rp, log_id=archive_id, log_kind="archive")
    if remote is not None:
        return JobFileDownloadLink(mode="redirect", url=remote)
    return JobFileDownloadLink(mode="blob", url=f"/files/archive/{archive_id}")
