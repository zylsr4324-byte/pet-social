"""fix pets owner_id constraints

Revision ID: b943c9d63cf3
Revises: 7195d8f88f07
Create Date: 2026-03-28 09:41:38.965654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b943c9d63cf3'
down_revision: Union[str, None] = '7195d8f88f07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Delete orphan pets with no owner (created before auth was added)
    op.execute("DELETE FROM messages WHERE pet_id IN (SELECT id FROM pets WHERE owner_id IS NULL)")
    op.execute("DELETE FROM pets WHERE owner_id IS NULL")
    op.alter_column('pets', 'owner_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.create_foreign_key('fk_pets_owner_id', 'pets', 'users', ['owner_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_pets_owner_id', 'pets', type_='foreignkey')
    op.alter_column('pets', 'owner_id',
               existing_type=sa.INTEGER(),
               nullable=True)
