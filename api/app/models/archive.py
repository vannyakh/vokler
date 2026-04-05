from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.job import JobStatus, _job_status_values

if TYPE_CHECKING:
    from app.models.user import User


class ArchiveJob(Base):
    """Batch download: many URLs → one ZIP artifact."""

    __tablename__ = "archive_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[JobStatus] = mapped_column(
        PG_ENUM(
            JobStatus,
            name="job_status",
            create_type=False,
            values_callable=_job_status_values,
        ),
        default=JobStatus.PENDING,
    )
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_format: Mapped[str] = mapped_column(String(512), default="original")
    label: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_urls: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    result_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user: Mapped["User | None"] = relationship(back_populates="archive_jobs")
