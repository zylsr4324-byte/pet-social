"""legacy local schema anchor

Revision ID: f8c9d0e1a2b3
Revises: f7b8c9d0e1a2
Create Date: 2026-04-17 00:00:00.000000

This no-op revision preserves compatibility with local databases that were
previously stamped at f7b8c9d0e1a2 while already matching the current furniture
and shop schema.

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f8c9d0e1a2b3"
down_revision: Union[str, None] = "f7b8c9d0e1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
