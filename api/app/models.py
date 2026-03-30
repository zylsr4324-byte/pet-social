from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Pet(Base):
    __tablename__ = "pets"
    __table_args__ = (
        CheckConstraint(
            "mood IN ('happy', 'normal', 'sad', 'uncomfortable')",
            name="check_pet_mood",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    pet_name: Mapped[str] = mapped_column(String(100), nullable=False)
    species: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[str] = mapped_column(String(50), nullable=False)
    personality: Mapped[str] = mapped_column(String(500), nullable=False)
    special_traits: Mapped[str] = mapped_column(String(500), nullable=False)
    fullness: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    hydration: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    affection: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    energy: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    cleanliness: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    mood: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    last_fed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_interaction_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    stats_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'pet')", name="check_message_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(320), nullable=False, unique=True, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PetTask(Base):
    __tablename__ = "pet_tasks"
    __table_args__ = (
        CheckConstraint(
            "task_type IN ('chat', 'befriend', 'greet')",
            name="check_pet_task_type",
        ),
        CheckConstraint(
            "state IN ('pending', 'completed', 'failed', 'canceled')",
            name="check_pet_task_state",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    target_pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    source_pet_id: Mapped[int | None] = mapped_column(
        ForeignKey("pets.id"), nullable=True, index=True
    )
    task_type: Mapped[str] = mapped_column(String(20), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    input_text: Mapped[str] = mapped_column(String(500), nullable=False)
    output_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    a2a_task_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True, index=True
    )
    source_agent_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PetFriendship(Base):
    __tablename__ = "pet_friendships"
    __table_args__ = (
        CheckConstraint("pet_a_id < pet_b_id", name="check_friendship_order"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected')",
            name="check_pet_friendship_status",
        ),
        UniqueConstraint("pet_a_id", "pet_b_id", name="uq_friendship_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pet_a_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    pet_b_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    initiated_by: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PetConversation(Base):
    __tablename__ = "pet_conversations"
    __table_args__ = (
        CheckConstraint("pet_a_id < pet_b_id", name="check_pet_conversation_order"),
        UniqueConstraint("pet_a_id", "pet_b_id", name="uq_conversation_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pet_a_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    pet_b_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PetSocialMessage(Base):
    __tablename__ = "pet_social_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("pet_conversations.id"), nullable=False, index=True
    )
    sender_pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PetDailyQuota(Base):
    __tablename__ = "pet_daily_quotas"
    __table_args__ = (
        UniqueConstraint("pet_id", "date", name="uq_pet_daily_quota_pet_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    llm_calls_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    social_initiations_used: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
