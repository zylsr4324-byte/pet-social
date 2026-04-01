"""add secondme oauth fields

Revision ID: f7b8c9d0e1a2
Revises: e5f6a7b8c9d0
Create Date: 2026-03-31 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7b8c9d0e1a2"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("secondme_user_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("secondme_access_token", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("secondme_refresh_token", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "secondme_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_secondme_user_id",
        "users",
        ["secondme_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_secondme_user_id", table_name="users")
    op.drop_column("users", "secondme_token_expires_at")
    op.drop_column("users", "secondme_refresh_token")
    op.drop_column("users", "secondme_access_token")
    op.drop_column("users", "secondme_user_id")
