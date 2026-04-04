import logging
from pathlib import Path
from uuid import UUID

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_optional_user_id
from app.models.job import DownloadJob, JobStatus
from app.schemas.job import DownloadCreate, JobPublic
from app.schemas.preview import MediaFormatRow, PreviewRequest, PreviewResponse
from app.services.downloader import extract_preview
from app.services.url_parser import detect_platform

router = APIRouter()
logger = logging.getLogger(__name__)


async def _enqueue_download(job_id: UUID) -> None:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    pool = await create_pool(redis_settings)
    try:
        await pool.enqueue_job("run_download_job", str(job_id))
    finally:
        await pool.close()


@router.post("/preview", response_model=PreviewResponse)
async def preview_media(body: PreviewRequest):
    url = str(body.url).strip()
    try:
        data = await extract_preview(url)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    format_rows = data.pop("formats")
    formats = [MediaFormatRow.model_validate(f) for f in format_rows]
    return PreviewResponse(**data, formats=formats)


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


@router.get("/jobs/{job_id}/file")
async def download_job_file(
    job_id: UUID,
    requester_id: UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Serve the finished file for browser download (same auth rules as ``get_job``)."""
    job = await db.scalar(select(DownloadJob).where(DownloadJob.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.user_id is not None and requester_id != job.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != JobStatus.COMPLETED or not job.result_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File not ready or download failed",
        )
    base = Path(settings.local_storage_path).resolve()
    try:
        path = Path(job.result_path).resolve()
    except OSError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    try:
        path.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid path")
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
    return FileResponse(
        path,
        filename=path.name,
        media_type="application/octet-stream",
    )
