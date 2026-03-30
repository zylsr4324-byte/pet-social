"""fix timestamp defaults on pets table

Revision ID: a1b2c3d4e5f6
Revises: f2d3a1b4c5d6
Create Date: 2026-03-30 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f2d3a1b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE pets ALTER COLUMN stats_updated_at SET DEFAULT now()"
    )
    op.execute(
        "ALTER TABLE pets ALTER COLUMN created_at SET DEFAULT now()"
    )
    op.execute(
        "ALTER TABLE pets ALTER COLUMN updated_at SET DEFAULT now()"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE pets ALTER COLUMN stats_updated_at DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE pets ALTER COLUMN created_at DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE pets ALTER COLUMN updated_at DROP DEFAULT"
    )
