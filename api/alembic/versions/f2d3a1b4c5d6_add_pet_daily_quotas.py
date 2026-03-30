"""add pet daily quotas

Revision ID: f2d3a1b4c5d6
Revises: 7896c1f0bb2d
Create Date: 2026-03-30 10:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2d3a1b4c5d6"
down_revision: Union[str, None] = "7896c1f0bb2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pet_daily_quotas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pet_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("llm_calls_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "social_initiations_used",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.ForeignKeyConstraint(["pet_id"], ["pets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pet_id", "date", name="uq_pet_daily_quota_pet_date"),
    )
    op.create_index(
        "ix_pet_daily_quotas_pet_id", "pet_daily_quotas", ["pet_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_pet_daily_quotas_pet_id", table_name="pet_daily_quotas")
    op.drop_table("pet_daily_quotas")
