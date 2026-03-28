"""add pet survival system fields

Revision ID: c5081df293cb
Revises: b943c9d63cf3
Create Date: 2026-03-28 10:10:28.926934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5081df293cb'
down_revision: Union[str, None] = 'b943c9d63cf3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns as nullable first
    op.add_column('pets', sa.Column('fullness', sa.Integer(), nullable=True))
    op.add_column('pets', sa.Column('hydration', sa.Integer(), nullable=True))
    op.add_column('pets', sa.Column('affection', sa.Integer(), nullable=True))
    op.add_column('pets', sa.Column('energy', sa.Integer(), nullable=True))
    op.add_column('pets', sa.Column('cleanliness', sa.Integer(), nullable=True))
    op.add_column('pets', sa.Column('mood', sa.String(length=20), nullable=True))
    op.add_column('pets', sa.Column('last_fed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('pets', sa.Column('last_interaction_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('pets', sa.Column('stats_updated_at', sa.DateTime(timezone=True), nullable=True))

    # Fill defaults for existing rows
    op.execute("UPDATE pets SET fullness = 100 WHERE fullness IS NULL")
    op.execute("UPDATE pets SET hydration = 100 WHERE hydration IS NULL")
    op.execute("UPDATE pets SET affection = 50 WHERE affection IS NULL")
    op.execute("UPDATE pets SET energy = 100 WHERE energy IS NULL")
    op.execute("UPDATE pets SET cleanliness = 100 WHERE cleanliness IS NULL")
    op.execute("UPDATE pets SET mood = 'normal' WHERE mood IS NULL")
    op.execute("UPDATE pets SET stats_updated_at = NOW() WHERE stats_updated_at IS NULL")

    # Set NOT NULL constraints
    op.alter_column('pets', 'fullness', nullable=False)
    op.alter_column('pets', 'hydration', nullable=False)
    op.alter_column('pets', 'affection', nullable=False)
    op.alter_column('pets', 'energy', nullable=False)
    op.alter_column('pets', 'cleanliness', nullable=False)
    op.alter_column('pets', 'mood', nullable=False)
    op.alter_column('pets', 'stats_updated_at', nullable=False)

    # Add check constraint for mood
    op.create_check_constraint(
        'check_pet_mood',
        'pets',
        "mood IN ('happy', 'normal', 'sad', 'uncomfortable')"
    )


def downgrade() -> None:
    op.drop_constraint('check_pet_mood', 'pets', type_='check')
    op.drop_column('pets', 'stats_updated_at')
    op.drop_column('pets', 'last_interaction_at')
    op.drop_column('pets', 'last_fed_at')
    op.drop_column('pets', 'mood')
    op.drop_column('pets', 'cleanliness')
    op.drop_column('pets', 'energy')
    op.drop_column('pets', 'affection')
    op.drop_column('pets', 'hydration')
    op.drop_column('pets', 'fullness')
