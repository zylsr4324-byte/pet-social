"""add furniture system

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-30 13:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FURNITURE_TEMPLATES = [
    (1, "食盆", "food", 1, 1, "bowl_food", "feed", "{}"),
    (2, "水盆", "water", 1, 1, "bowl_water", "drink", "{}"),
    (3, "玩具", "toy", 1, 1, "toy_ball", "play", "{}"),
    (4, "床", "bed", 2, 1, "pet_bed", "bed", "{}"),
    (5, "猫爬架", "toy", 1, 2, "cat_tree", "play", "{}"),
    (6, "沙发", "decoration", 2, 1, "sofa", None, "{}"),
    (7, "地毯", "decoration", 2, 2, "rug", None, "{}"),
    (8, "植物", "decoration", 1, 1, "plant", None, "{}"),
]


def upgrade() -> None:
    op.create_table(
        "furniture_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("height", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sprite_key", sa.String(length=100), nullable=False),
        sa.Column("interaction_action", sa.String(length=50), nullable=True),
        sa.Column("effects", sa.String(length=500), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_furniture_templates_id", "furniture_templates", ["id"])

    op.create_table(
        "placed_furniture",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pet_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("tile_x", sa.Integer(), nullable=False),
        sa.Column("tile_y", sa.Integer(), nullable=False),
        sa.Column("flipped", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("placed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["pet_id"], ["pets.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["furniture_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pet_id", "tile_x", "tile_y", name="uq_placed_furniture_position"),
    )
    op.create_index("ix_placed_furniture_id", "placed_furniture", ["id"])
    op.create_index("ix_placed_furniture_pet_id", "placed_furniture", ["pet_id"])

    # Seed furniture templates
    op.bulk_insert(
        sa.table(
            "furniture_templates",
            sa.column("id", sa.Integer),
            sa.column("name", sa.String),
            sa.column("category", sa.String),
            sa.column("width", sa.Integer),
            sa.column("height", sa.Integer),
            sa.column("sprite_key", sa.String),
            sa.column("interaction_action", sa.String),
            sa.column("effects", sa.String),
        ),
        [
            {"id": tid, "name": name, "category": cat, "width": w, "height": h,
             "sprite_key": sk, "interaction_action": ia, "effects": ef}
            for tid, name, cat, w, h, sk, ia, ef in FURNITURE_TEMPLATES
        ],
    )


def downgrade() -> None:
    op.drop_table("placed_furniture")
    op.drop_table("furniture_templates")
