"""add shop system

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-30 23:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("coins", sa.Integer(), nullable=False, server_default="500"),
    )

    op.create_table(
        "user_furniture_inventory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "purchased_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["template_id"], ["furniture_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "template_id", name="uq_user_inventory_template"),
        sa.CheckConstraint("quantity >= 0", name="check_inventory_quantity_non_negative"),
    )
    op.create_index(
        "ix_user_furniture_inventory_id",
        "user_furniture_inventory",
        ["id"],
    )
    op.create_index(
        "ix_user_furniture_inventory_user_id",
        "user_furniture_inventory",
        ["user_id"],
    )
    op.create_index(
        "ix_user_furniture_inventory_template_id",
        "user_furniture_inventory",
        ["template_id"],
    )

    op.execute(
        """
        INSERT INTO user_furniture_inventory (user_id, template_id, quantity)
        SELECT users.id, furniture_templates.id, 1
        FROM users
        CROSS JOIN furniture_templates
        WHERE furniture_templates.interaction_action IN ('feed', 'drink', 'play', 'bed')
        """
    )

    op.alter_column("users", "coins", server_default=None)
    op.alter_column("user_furniture_inventory", "quantity", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_user_furniture_inventory_template_id", table_name="user_furniture_inventory")
    op.drop_index("ix_user_furniture_inventory_user_id", table_name="user_furniture_inventory")
    op.drop_index("ix_user_furniture_inventory_id", table_name="user_furniture_inventory")
    op.drop_table("user_furniture_inventory")
    op.drop_column("users", "coins")
