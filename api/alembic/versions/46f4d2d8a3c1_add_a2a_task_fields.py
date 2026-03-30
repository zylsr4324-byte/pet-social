"""add a2a task fields

Revision ID: 46f4d2d8a3c1
Revises: 58df8138b6f1
Create Date: 2026-03-29 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "46f4d2d8a3c1"
down_revision: Union[str, None] = "58df8138b6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pet_tasks",
        sa.Column("a2a_task_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "pet_tasks",
        sa.Column("source_agent_url", sa.String(length=500), nullable=True),
    )
    op.create_index("ix_pet_tasks_a2a_task_id", "pet_tasks", ["a2a_task_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_pet_tasks_a2a_task_id", table_name="pet_tasks")
    op.drop_column("pet_tasks", "source_agent_url")
    op.drop_column("pet_tasks", "a2a_task_id")
