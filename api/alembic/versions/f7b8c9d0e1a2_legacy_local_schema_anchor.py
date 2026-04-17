"""legacy local schema anchor

Revision ID: f7b8c9d0e1a2
Revises: e5f6a7b8c9d0
Create Date: 2026-04-17 00:00:00.000000

This no-op revision preserves compatibility with local databases that were
previously stamped at f7b8c9d0e1a2 while already matching the current furniture
and shop schema.

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f7b8c9d0e1a2"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
