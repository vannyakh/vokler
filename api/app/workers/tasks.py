"""ARQ async tasks — yt-dlp download, local storage, history."""

import asyncio
import logging
import re
import shutil
import time
import zipfile
from pathlib import Path
from tempfile import mkdtemp
from uuid import UUID

from arq.connections import RedisSettings
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.archive import ArchiveJob
from app.models.history import HistoryEntry
from app.models.job import DownloadJob, JobStatus
from app.services.downloader import YtDlpDownloader
from app.services.storage import save_finished_artifact

logger = logging.getLogger(__name__)


async def _set_job_progress(job_id: UUID, progress: float) -> None:
    async with AsyncSessionLocal() as session:
        job = await session.get(DownloadJob, job_id)
        if job is None:
            return
        job.progress = min(100.0, max(0.0, progress))
        await session.commit()


async def _set_archive_progress(archive_id: UUID, progress: float, current_index: int) -> None:
    async with AsyncSessionLocal() as session:
        aj = await session.get(ArchiveJob, archive_id)
        if aj is None:
            return
        aj.progress = min(100.0, max(0.0, progress))
        aj.current_index = current_index
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

        dest_uri = await save_finished_artifact(user_id, jid, src_path, src_path.name)

        async with AsyncSessionLocal() as session:
            job = await session.get(DownloadJob, jid)
            if job is None:
                return
            job.result_path = dest_uri
            job.progress = 100.0
            job.status = JobStatus.COMPLETED
            await session.commit()

            title = str(metadata.get("title") or f"Download {jid}")[:500]
            entry = HistoryEntry(
                user_id=user_id,
                job_id=jid,
                title=title,
                source_url=url,
                artifact_uri=dest_uri,
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


async def run_archive_job(ctx, archive_id: str) -> None:
    """Download many URLs into a temp folder, ZIP, then store like a single artifact."""
    aid = UUID(archive_id)
    loop = asyncio.get_running_loop()

    async with AsyncSessionLocal() as session:
        aj = await session.get(ArchiveJob, aid)
        if aj is None:
            return
        urls = list(aj.source_urls)
        user_id = aj.user_id
        fmt = aj.download_format or "original"
        bundle_label = (aj.label or "download").strip() or "download"
        aj.status = JobStatus.RUNNING
        aj.progress = max(aj.progress, 2.0)
        aj.error_message = None
        aj.current_index = 0
        await session.commit()

    total = len(urls)
    if total == 0:
        async with AsyncSessionLocal() as session:
            aj = await session.get(ArchiveJob, aid)
            if aj:
                aj.status = JobStatus.FAILED
                aj.error_message = "No URLs to download"
                await session.commit()
        return

    staging = Path(mkdtemp(prefix="vokler_archive_"))
    collect = staging / "files"
    collect.mkdir(parents=True)

    segment = 85.0 / total

    def make_hook(i: int):
        last_flush = [0.0]

        def progress_hook(data: dict) -> None:
            if data.get("status") != "downloading":
                return
            tbytes = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            downloaded = data.get("downloaded_bytes") or 0
            if not tbytes or tbytes <= 0:
                return
            inner = downloaded / float(tbytes)
            pct = 5.0 + i * segment + 0.92 * segment * inner
            now = time.monotonic()
            if inner < 0.99 and now - last_flush[0] < 0.35:
                return
            last_flush[0] = now
            fut = asyncio.run_coroutine_threadsafe(
                _set_archive_progress(aid, pct, i),
                loop,
            )

            def _log_done(f: asyncio.Future[None]) -> None:
                err = f.exception()
                if err:
                    logger.debug("archive progress update failed: %s", err)

            fut.add_done_callback(_log_done)

        return progress_hook

    try:
        for idx, page_url in enumerate(urls):
            await _set_archive_progress(aid, 5.0 + idx * segment, idx)
            downloader = YtDlpDownloader(fmt, progress_hook=make_hook(idx))
            tmp_dir_path: Path | None = None
            try:
                src_path, _metadata, tmp_dir = await downloader.download(page_url)
                tmp_dir_path = tmp_dir
                dest_name = f"{idx + 1:03d}_{src_path.name}"
                dest = collect / dest_name
                shutil.copy2(src_path, dest)
            finally:
                if tmp_dir_path is not None:
                    await asyncio.to_thread(shutil.rmtree, str(tmp_dir_path), True)

        await _set_archive_progress(aid, 93.0, total)

        safe_label = re.sub(r"[^\w.\-]+", "_", bundle_label)[:80].strip("_") or "download"
        zip_path = staging / f"{safe_label}.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for p in sorted(collect.iterdir()):
                if p.is_file():
                    zf.write(p, arcname=p.name)

        await _set_archive_progress(aid, 96.0, total)

        dest_uri = await save_finished_artifact(user_id, aid, zip_path, zip_path.name)

        async with AsyncSessionLocal() as session:
            aj = await session.get(ArchiveJob, aid)
            if aj is None:
                return
            aj.result_path = dest_uri
            aj.progress = 100.0
            aj.status = JobStatus.COMPLETED
            aj.current_index = total
            await session.commit()

            entry = HistoryEntry(
                user_id=user_id,
                job_id=None,
                title=f"ZIP ({total} items): {bundle_label}"[:500],
                source_url=urls[0][:2000],
                artifact_uri=dest_uri,
            )
            session.add(entry)
            await session.commit()
    except Exception as e:
        logger.exception("archive job failed: %s", aid)
        async with AsyncSessionLocal() as session:
            aj = await session.get(ArchiveJob, aid)
            if aj:
                aj.status = JobStatus.FAILED
                aj.error_message = str(e)[:4000]
                await session.commit()
    finally:
        await asyncio.to_thread(shutil.rmtree, str(staging), True)


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [run_download_job, run_archive_job]
