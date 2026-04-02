"""Widen download_format for raw yt-dlp selectors.

Revision ID: 004_download_format_length
Revises: 003_history_user_nullable
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_download_format_length"
down_revision: Union[str, Sequence[str], None] = "003_history_user_nullable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "download_jobs",
        "download_format",
        existing_type=sa.String(length=64),
        type_=sa.String(length=512),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "download_jobs",
        "download_format",
        existing_type=sa.String(length=512),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
