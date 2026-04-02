"""Add download_format to download_jobs.

Revision ID: 002_download_format
Revises: 001_initial
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_download_format"
down_revision: Union[str, Sequence[str], None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "download_jobs",
        sa.Column(
            "download_format",
            sa.String(length=64),
            nullable=False,
            server_default="original",
        ),
    )
    op.alter_column("download_jobs", "download_format", server_default=None)


def downgrade() -> None:
    op.drop_column("download_jobs", "download_format")
