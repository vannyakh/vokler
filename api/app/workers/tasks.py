"""ARQ async tasks — yt-dlp download, local storage, history."""

import asyncio
import logging
import shutil
import time
from uuid import UUID

from arq.connections import RedisSettings
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.history import HistoryEntry
from app.models.job import DownloadJob, JobStatus
from app.services.downloader import YtDlpDownloader
from app.services.storage import local_save

logger = logging.getLogger(__name__)


async def _set_job_progress(job_id: UUID, progress: float) -> None:
    async with AsyncSessionLocal() as session:
        job = await session.get(DownloadJob, job_id)
        if job is None:
            return
        job.progress = min(100.0, max(0.0, progress))
        await session.commit()


async def run_download_job(ctx, job_id: str) -> None:
    jid = UUID(job_id)
    loop = asyncio.get_running_loop()
    last_flush = [0.0]

    def progress_hook(data: dict) -> None:
        if data.get("status") != "downloading":
            return
        total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
        downloaded = data.get("downloaded_bytes") or 0
        if not total or total <= 0:
            return
        pct = 5.0 + 90.0 * (downloaded / float(total))
        now = time.monotonic()
        if pct < 99.0 and now - last_flush[0] < 0.4:
            return
        last_flush[0] = now
        fut = asyncio.run_coroutine_threadsafe(_set_job_progress(jid, pct), loop)

        def _log_done(f: asyncio.Future[None]) -> None:
            err = f.exception()
            if err:
                logger.debug("progress update failed: %s", err)

        fut.add_done_callback(_log_done)

    async with AsyncSessionLocal() as session:
        job = await session.get(DownloadJob, jid)
        if job is None:
            return
        job.status = JobStatus.RUNNING
        job.progress = max(job.progress, 5.0)
        job.error_message = None
        url = job.url
        user_id = job.user_id
        fmt = job.download_format or "original"
        await session.commit()

    tmp_root: str | None = None
    downloader = YtDlpDownloader(fmt, progress_hook=progress_hook)

    try:
        src_path, metadata, tmp_dir = await downloader.download(url)
        tmp_root = str(tmp_dir)
        await _set_job_progress(jid, 96.0)

        dest = await local_save(user_id, jid, src_path, src_path.name)

        async with AsyncSessionLocal() as session:
            job = await session.get(DownloadJob, jid)
            if job is None:
                return
            job.result_path = str(dest)
            job.progress = 100.0
            job.status = JobStatus.COMPLETED
            await session.commit()

            title = str(metadata.get("title") or f"Download {jid}")[:500]
            entry = HistoryEntry(
                user_id=user_id,
                job_id=jid,
                title=title,
                source_url=url,
                artifact_uri=str(dest),
            )
            session.add(entry)
            await session.commit()
    except Exception as e:
        logger.exception("download job failed: %s", jid)
        async with AsyncSessionLocal() as session:
            job = await session.get(DownloadJob, jid)
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(e)[:4000]
                await session.commit()
    finally:
        if tmp_root:
            await asyncio.to_thread(shutil.rmtree, tmp_root, True)


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [run_download_job]
