from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Message, Pet
from app.services.llm_client import request_llm_reply
from app.services.pet_personality import (
    build_personality_style_rules,
    build_pet_profile_summary,
    build_turn_specific_guard,
    read_latest_user_message,
)
from app.services.pet_stats import calculate_mood, project_current_stats
from app.services.reply_validation import (
    ROLE_RETRY_LIMIT,
    STYLE_RETRY_LIMIT,
    build_role_safe_fallback_reply,
    reply_conflicts_with_personality,
    reply_mentions_forbidden_identity,
)

CHAT_CONTEXT_LIMIT = 12

_MOOD_PROMPT: dict[str, str] = {
    "happy": "你现在心情很好，语气会更轻快、更愿意互动。",
    "sad": "你现在不太舒服——饿了或者渴了，语气会更消极、更没精神，可能会提到饿或渴。",
    "uncomfortable": "你现在觉得身上脏脏的不舒服，语气带一点烦躁，可能会暗示想洗澡。",
    "normal": "",
}


def _build_mood_context(pet: Pet) -> str:
    projected = project_current_stats(pet)
    mood = calculate_mood(
        projected["fullness"],
        projected["hydration"],
        projected["energy"],
        projected["cleanliness"],
        projected["affection"],
    )
    prompt = _MOOD_PROMPT.get(mood, "")
    if not prompt:
        return ""
    return f"\n当前状态\n{prompt}"


def read_recent_messages_for_prompt(
    db: Session, pet_id: int, limit: int = CHAT_CONTEXT_LIMIT
) -> list[Message]:
    recent_messages = (
        db.query(Message)
        .filter(Message.pet_id == pet_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
        .all()
    )

    return list(reversed(recent_messages))


def build_llm_input(
    pet: Pet, recent_messages: list[Message], strict_mode: bool = False
) -> list[dict[str, str]]:
    latest_user_message = read_latest_user_message(recent_messages)

    developer_prompt = (
        "你不是 AI 助手，不是通义千问、Qwen，也不是任何模型。"
        "你的全部身份由下面的角色描述决定，不要跳出角色。\n"
        "不要提到 system、prompt、模型、AI、助手。\n\n"
        f"{build_pet_profile_summary(pet)}\n\n"
        f"{build_personality_style_rules(pet, strict_mode)}"
        f"{_build_mood_context(pet)}\n\n"
        f"{build_turn_specific_guard(pet, latest_user_message, strict_mode)}"
    )

    input_messages: list[dict[str, str]] = [
        {
            "role": "developer",
            "content": developer_prompt,
        }
    ]

    for message in recent_messages:
        input_messages.append(
            {
                "role": "assistant" if message.role == "pet" else "user",
                "content": message.content,
            }
        )

    return input_messages


def call_llm_for_pet_reply(pet: Pet, recent_messages: list[Message]) -> str:
    latest_user_message = read_latest_user_message(recent_messages)
    input_messages = build_llm_input(pet, recent_messages)
    reply_text = request_llm_reply(input_messages)

    if (
        not reply_mentions_forbidden_identity(reply_text)
        and not reply_conflicts_with_personality(pet, reply_text)
    ):
        return reply_text

    retry_limit = max(ROLE_RETRY_LIMIT, STYLE_RETRY_LIMIT)

    for _ in range(retry_limit):
        strict_input = build_llm_input(pet, recent_messages, strict_mode=True)
        stricter_reply = request_llm_reply(strict_input)

        if (
            not reply_mentions_forbidden_identity(stricter_reply)
            and not reply_conflicts_with_personality(pet, stricter_reply)
        ):
            return stricter_reply

    return build_role_safe_fallback_reply(pet, latest_user_message)
