"""add room and rotation to placed furniture

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-03-30 22:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "placed_furniture",
        sa.Column("room", sa.String(length=20), nullable=False, server_default="living"),
    )
    op.add_column(
        "placed_furniture",
        sa.Column("rotation", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute(
        """
        UPDATE placed_furniture
        SET room = CASE
            WHEN template_id IN (
                SELECT id
                FROM furniture_templates
                WHERE interaction_action IN ('feed', 'drink')
            ) THEN 'kitchen'
            WHEN template_id IN (
                SELECT id
                FROM furniture_templates
                WHERE interaction_action = 'bed' OR category = 'bed'
            ) THEN 'bedroom'
            ELSE 'living'
        END
        """
    )

    op.drop_constraint(
        "uq_placed_furniture_position",
        "placed_furniture",
        type_="unique",
    )
    op.create_check_constraint(
        "check_placed_furniture_room",
        "placed_furniture",
        "room IN ('living', 'bedroom', 'kitchen')",
    )
    op.create_check_constraint(
        "check_placed_furniture_rotation",
        "placed_furniture",
        "rotation IN (0, 90, 180, 270)",
    )
    op.create_unique_constraint(
        "uq_placed_furniture_position",
        "placed_furniture",
        ["pet_id", "room", "tile_x", "tile_y"],
    )

    op.alter_column("placed_furniture", "room", server_default=None)
    op.alter_column("placed_furniture", "rotation", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "uq_placed_furniture_position",
        "placed_furniture",
        type_="unique",
    )
    op.drop_constraint(
        "check_placed_furniture_rotation",
        "placed_furniture",
        type_="check",
    )
    op.drop_constraint(
        "check_placed_furniture_room",
        "placed_furniture",
        type_="check",
    )
    op.create_unique_constraint(
        "uq_placed_furniture_position",
        "placed_furniture",
        ["pet_id", "tile_x", "tile_y"],
    )
    op.drop_column("placed_furniture", "rotation")
    op.drop_column("placed_furniture", "room")
