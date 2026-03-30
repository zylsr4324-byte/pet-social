"""add pet task canceled state

Revision ID: 7896c1f0bb2d
Revises: 46f4d2d8a3c1
Create Date: 2026-03-29 13:10:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7896c1f0bb2d"
down_revision: Union[str, None] = "46f4d2d8a3c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("check_pet_task_state", "pet_tasks", type_="check")
    op.create_check_constraint(
        "check_pet_task_state",
        "pet_tasks",
        "state IN ('pending', 'completed', 'failed', 'canceled')",
    )


def downgrade() -> None:
    op.drop_constraint("check_pet_task_state", "pet_tasks", type_="check")
    op.create_check_constraint(
        "check_pet_task_state",
        "pet_tasks",
        "state IN ('pending', 'completed', 'failed')",
    )
