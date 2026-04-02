"""S3 or local file storage for finished downloads."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

import aioboto3

from app.config import settings


async def local_save(
    user_id: UUID | None,
    job_id: UUID,
    src: Path,
    filename: str,
) -> Path:
    owner = str(user_id) if user_id is not None else "anonymous"
    base = Path(settings.local_storage_path) / owner / str(job_id)
    base.mkdir(parents=True, exist_ok=True)
    dest = base / filename
    dest.write_bytes(src.read_bytes())
    return dest


async def s3_upload(
    user_id: UUID,
    job_id: UUID,
    src: Path,
    key_suffix: str,
    session: aioboto3.Session | None = None,
) -> str:
    bucket = settings.s3_bucket
    if not bucket:
        raise RuntimeError("S3 bucket not configured")
    sess = session or aioboto3.Session()
    key = f"{user_id}/{job_id}/{key_suffix}"
    async with sess.client(
        "s3",
        region_name=settings.s3_region or "us-east-1",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    ) as client:
        await client.upload_file(str(src), bucket, key)
    return key
