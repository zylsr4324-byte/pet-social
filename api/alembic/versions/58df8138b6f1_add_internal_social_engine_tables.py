"""add internal social engine tables

Revision ID: 58df8138b6f1
Revises: c5081df293cb
Create Date: 2026-03-28 16:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "58df8138b6f1"
down_revision: Union[str, None] = "c5081df293cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pet_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "target_pet_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column(
            "source_pet_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=True,
        ),
        sa.Column("task_type", sa.String(length=20), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("input_text", sa.String(length=500), nullable=False),
        sa.Column("output_text", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "task_type IN ('chat', 'befriend', 'greet')",
            name="check_pet_task_type",
        ),
        sa.CheckConstraint(
            "state IN ('pending', 'completed', 'failed')",
            name="check_pet_task_state",
        ),
    )
    op.create_index("ix_pet_tasks_target_pet_id", "pet_tasks", ["target_pet_id"])
    op.create_index("ix_pet_tasks_source_pet_id", "pet_tasks", ["source_pet_id"])

    op.create_table(
        "pet_friendships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pet_a_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column(
            "pet_b_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column(
            "initiated_by",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("pet_a_id < pet_b_id", name="check_friendship_order"),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected')",
            name="check_pet_friendship_status",
        ),
        sa.UniqueConstraint("pet_a_id", "pet_b_id", name="uq_friendship_pair"),
    )
    op.create_index("ix_pet_friendships_pet_a_id", "pet_friendships", ["pet_a_id"])
    op.create_index("ix_pet_friendships_pet_b_id", "pet_friendships", ["pet_b_id"])
    op.create_index(
        "ix_pet_friendships_initiated_by", "pet_friendships", ["initiated_by"]
    )

    op.create_table(
        "pet_conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pet_a_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column(
            "pet_b_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "pet_a_id < pet_b_id", name="check_pet_conversation_order"
        ),
        sa.UniqueConstraint("pet_a_id", "pet_b_id", name="uq_conversation_pair"),
    )
    op.create_index(
        "ix_pet_conversations_pet_a_id", "pet_conversations", ["pet_a_id"]
    )
    op.create_index(
        "ix_pet_conversations_pet_b_id", "pet_conversations", ["pet_b_id"]
    )

    op.create_table(
        "pet_social_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Integer(),
            sa.ForeignKey("pet_conversations.id"),
            nullable=False,
        ),
        sa.Column(
            "sender_pet_id",
            sa.Integer(),
            sa.ForeignKey("pets.id"),
            nullable=False,
        ),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_pet_social_messages_conversation_id",
        "pet_social_messages",
        ["conversation_id"],
    )
    op.create_index(
        "ix_pet_social_messages_sender_pet_id",
        "pet_social_messages",
        ["sender_pet_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_pet_social_messages_sender_pet_id", table_name="pet_social_messages")
    op.drop_index(
        "ix_pet_social_messages_conversation_id", table_name="pet_social_messages"
    )
    op.drop_table("pet_social_messages")

    op.drop_index("ix_pet_conversations_pet_b_id", table_name="pet_conversations")
    op.drop_index("ix_pet_conversations_pet_a_id", table_name="pet_conversations")
    op.drop_table("pet_conversations")

    op.drop_index("ix_pet_friendships_initiated_by", table_name="pet_friendships")
    op.drop_index("ix_pet_friendships_pet_b_id", table_name="pet_friendships")
    op.drop_index("ix_pet_friendships_pet_a_id", table_name="pet_friendships")
    op.drop_table("pet_friendships")

    op.drop_index("ix_pet_tasks_source_pet_id", table_name="pet_tasks")
    op.drop_index("ix_pet_tasks_target_pet_id", table_name="pet_tasks")
    op.drop_table("pet_tasks")
