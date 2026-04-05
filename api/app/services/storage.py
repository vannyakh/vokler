"""S3-compatible (incl. Cloudflare R2) or local file storage for finished downloads."""

from __future__ import annotations

import asyncio
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

import aioboto3
import boto3
from botocore.config import Config

from app.config import settings


def _owner_segment(user_id: UUID | None) -> str:
    return str(user_id) if user_id is not None else "anonymous"


def object_key(user_id: UUID | None, job_id: UUID, filename: str) -> str:
    return f"{_owner_segment(user_id)}/{job_id}/{filename}"


def _s3_client_kwargs() -> dict:
    kwargs: dict = {
        "service_name": "s3",
        "region_name": settings.s3_region or "auto",
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    if settings.s3_force_path_style:
        kwargs["config"] = Config(
            s3={"addressing_style": "path"},
            signature_version="s3v4",
        )
    return kwargs


def parse_s3_uri(uri: str) -> tuple[str, str] | None:
    """Parse ``s3://bucket/key`` (key may contain ``/``)."""
    u = (uri or "").strip()
    if not u.startswith("s3://"):
        return None
    rest = u[5:]
    slash = rest.find("/")
    if slash <= 0:
        return None
    bucket, key = rest[:slash], rest[slash + 1 :]
    if not bucket or not key:
        return None
    return bucket, key


def public_https_url_for_key(key: str) -> str | None:
    """If ``r2_public_base_url`` is set, return a public URL for the object key."""
    base = (settings.r2_public_base_url or "").strip().rstrip("/")
    if not base:
        return None
    safe_key = "/".join(quote(seg, safe="") for seg in key.split("/"))
    return f"{base}/{safe_key}"


async def local_save(
    user_id: UUID | None,
    job_id: UUID,
    src: Path,
    filename: str,
) -> Path:
    owner = _owner_segment(user_id)
    base = Path(settings.local_storage_path) / owner / str(job_id)
    base.mkdir(parents=True, exist_ok=True)
    dest = base / filename
    dest.write_bytes(src.read_bytes())
    return dest


async def s3_upload(
    user_id: UUID | None,
    job_id: UUID,
    src: Path,
    key_suffix: str,
    session: aioboto3.Session | None = None,
) -> str:
    bucket = settings.s3_bucket
    if not bucket:
        raise RuntimeError("S3/R2 bucket not configured (S3_BUCKET)")
    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        raise RuntimeError("S3/R2 credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)")
    key = object_key(user_id, job_id, key_suffix)
    sess = session or aioboto3.Session()
    client_kwargs = _s3_client_kwargs()
    async with sess.client(**client_kwargs) as client:
        await client.upload_file(str(src), bucket, key)
    return key


def presigned_get_url(bucket: str, key: str, expires_in: int = 3600) -> str:
    """Sync presigned GET; run in a thread from async routes."""
    client = boto3.client(**_s3_client_kwargs())
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


async def presigned_get_url_async(bucket: str, key: str, expires_in: int = 3600) -> str:
    return await asyncio.to_thread(presigned_get_url, bucket, key, expires_in)


async def save_finished_artifact(
    user_id: UUID | None,
    job_id: UUID,
    src: Path,
    filename: str,
) -> str:
    """
    Store the finished file according to ``storage_backend`` and return a value suitable
    for ``DownloadJob.result_path``: local path, HTTPS URL, or ``s3://bucket/key``.
    """
    backend = (settings.storage_backend or "local").lower()
    if backend == "local":
        dest = await local_save(user_id, job_id, src, filename)
        return str(dest)

    if backend in ("s3", "r2", "cloud"):
        key = await s3_upload(user_id, job_id, src, filename)
        public = public_https_url_for_key(key)
        if public:
            return public
        bucket = settings.s3_bucket
        assert bucket is not None
        return f"s3://{bucket}/{key}"

    raise RuntimeError(f"Unknown storage_backend: {settings.storage_backend!r}")
