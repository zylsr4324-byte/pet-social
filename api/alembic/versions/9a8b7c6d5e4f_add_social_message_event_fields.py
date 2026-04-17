"""add social message event fields

Revision ID: 9a8b7c6d5e4f
Revises: f7b8c9d0e1a2
Create Date: 2026-04-16 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, None] = "f7b8c9d0e1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pet_social_messages",
        sa.Column("emotion", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "pet_social_messages",
        sa.Column("action", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pet_social_messages", "action")
    op.drop_column("pet_social_messages", "emotion")
