from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


def _job_status_values(enum_cls: type[JobStatus]) -> list[str]:
    """Persist lowercase values to match PostgreSQL ``job_status`` (not enum member names)."""
    return [m.value for m in enum_cls]


class DownloadJob(Base):
    __tablename__ = "download_jobs"

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
    url: Mapped[str] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(String(64), nullable=True)
    download_format: Mapped[str] = mapped_column(String(512), default="original")
    status: Mapped[JobStatus] = mapped_column(
        PG_ENUM(
            JobStatus,
            name="job_status",
            create_type=False,
            values_callable=_job_status_values,
        ),
        default=JobStatus.PENDING,
    )
    progress: Mapped[float] = mapped_column(default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    user: Mapped[User | None] = relationship(back_populates="jobs")
