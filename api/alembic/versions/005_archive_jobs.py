"""Archive jobs: batch URLs → one ZIP.

Revision ID: 005_archive_jobs
Revises: 004_download_format_length
Create Date: 2026-04-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_archive_jobs"
down_revision: Union[str, Sequence[str], None] = "004_download_format_length"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

job_status = postgresql.ENUM(
    "pending",
    "running",
    "completed",
    "failed",
    name="job_status",
    create_type=False,
)


def upgrade() -> None:
    op.create_table(
        "archive_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("status", job_status, nullable=False),
        sa.Column("progress", sa.Float(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("download_format", sa.String(length=512), nullable=False),
        sa.Column("label", sa.String(length=512), nullable=True),
        sa.Column("source_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("total_items", sa.Integer(), nullable=False),
        sa.Column("current_index", sa.Integer(), nullable=False),
        sa.Column("result_path", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_archive_jobs_user_id"), "archive_jobs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_archive_jobs_user_id"), table_name="archive_jobs")
    op.drop_table("archive_jobs")
