from __future__ import annotations

import uuid
from typing import TYPE_CHECKING
from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.archive import ArchiveJob


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    jobs: Mapped[list[DownloadJob]] = relationship(back_populates="user")
    history: Mapped[list[HistoryEntry]] = relationship(back_populates="user")
    archive_jobs: Mapped[list["ArchiveJob"]] = relationship(back_populates="user")
