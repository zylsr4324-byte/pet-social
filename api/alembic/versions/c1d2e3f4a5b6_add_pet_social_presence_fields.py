"""add pet social presence fields

Revision ID: c1d2e3f4a5b6
Revises: 9a8b7c6d5e4f
Create Date: 2026-04-16 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pets",
        sa.Column("social_emotion", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "pets",
        sa.Column("social_action", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "pets",
        sa.Column("social_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "check_pet_social_emotion",
        "pets",
        "social_emotion IS NULL OR social_emotion IN ('calm', 'curious', 'guarded', 'excited', 'warm')",
    )


def downgrade() -> None:
    op.drop_constraint("check_pet_social_emotion", "pets", type_="check")
    op.drop_column("pets", "social_updated_at")
    op.drop_column("pets", "social_action")
    op.drop_column("pets", "social_emotion")
