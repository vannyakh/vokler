"""Allow anonymous history entries (nullable user_id).

Revision ID: 003_history_user_nullable
Revises: 002_download_format
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_history_user_nullable"
down_revision: Union[str, Sequence[str], None] = "002_download_format"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "history_entries",
        "user_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("DELETE FROM history_entries WHERE user_id IS NULL")
    op.alter_column(
        "history_entries",
        "user_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
