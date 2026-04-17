from datetime import datetime, timezone

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


def _get_elapsed_hint(timestamp: object) -> float | None:
    if not isinstance(timestamp, datetime):
        return None

    normalized_timestamp = (
        timestamp.replace(tzinfo=timezone.utc)
        if timestamp.tzinfo is None
        else timestamp.astimezone(timezone.utc)
    )
    return (datetime.now(timezone.utc) - normalized_timestamp).total_seconds() / 3600


def _build_life_context(pet: Pet) -> str:
    projected = project_current_stats(pet)
    mood = calculate_mood(
        projected["fullness"],
        projected["hydration"],
        projected["energy"],
        projected["cleanliness"],
        projected["affection"],
    )

    lines = ["生活语境"]
    mood_prompt = _MOOD_PROMPT.get(mood, "")
    if mood_prompt:
        lines.append(f"- {mood_prompt}")

    if projected["fullness"] < 35 and projected["hydration"] < 35:
        lines.append("- 你现在又饿又渴，耐心会短一点，更想先解决生理需求。")
    elif projected["fullness"] < 35:
        lines.append("- 你有点饿，容易先惦记吃的，再决定要不要多聊。")
    elif projected["hydration"] < 35:
        lines.append("- 你有点渴，回复会更像顺手应一声，不会太兴奋。")

    if projected["energy"] < 30:
        lines.append("- 你现在有点没精神，回复更短，动作也更懒一点。")
    elif projected["energy"] > 75:
        lines.append("- 你现在精神不错，容易接话，也可能主动靠近主人。")

    if projected["cleanliness"] < 30:
        lines.append("- 你觉得自己身上有点脏，不喜欢被过分折腾。")

    if projected["affection"] >= 75:
        lines.append("- 你已经很信任主人了，亲近会更自然。")
    elif projected["affection"] <= 35:
        lines.append("- 你还在观察主人，不会一下子表现得特别黏。")

    hours_since_interaction = _get_elapsed_hint(getattr(pet, "last_interaction_at", None))
    if hours_since_interaction is not None and hours_since_interaction <= 1:
        lines.append("- 主人刚和你互动过，你不用每句都重新试探。")
    elif hours_since_interaction is not None and hours_since_interaction >= 24:
        lines.append("- 你有一阵子没被注意到了，可能会更想确认对方有没有在意你。")

    hours_since_fed = _get_elapsed_hint(getattr(pet, "last_fed_at", None))
    if hours_since_fed is not None and hours_since_fed >= 12 and projected["fullness"] < 60:
        lines.append("- 你会惦记上一次进食已经过去一阵子了。")

    return "\n".join(lines)


def _build_conversation_rhythm_context(recent_messages: list[Message]) -> str:
    lines = ["对话节奏"]

    if not recent_messages:
        lines.append("- 这是刚开口的一轮，先自然接住对方，不要立刻背设定。")
        return "\n".join(lines)

    last_message = recent_messages[-1]
    if last_message.role == "user":
        lines.append("- 先回应主人刚刚这句话本身，不要答非所问。")

    if len(recent_messages) >= 4:
        lines.append("- 你们已经来回聊了几轮，语气可以更顺着上文，不要每次都像第一次见面。")

    user_turns = sum(1 for message in recent_messages if message.role == "user")
    pet_turns = sum(1 for message in recent_messages if message.role == "pet")

    if user_turns > pet_turns:
        lines.append("- 这轮是主人更主动，你只要接住情绪或话题，不必抢着主导。")
    elif pet_turns > user_turns + 1:
        lines.append("- 你最近已经说了不少，这次更像补一句自然反应。")

    return "\n".join(lines)


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
        f"{_build_life_context(pet)}\n\n"
        f"{_build_conversation_rhythm_context(recent_messages)}\n\n"
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


def create_pet_chat_turn(
    db: Session,
    pet: Pet,
    user_text: str,
) -> tuple[Message, Message]:
    normalized_user_text = user_text.strip()

    if not normalized_user_text:
        raise HTTPException(
            status_code=400,
            detail="Message content cannot be empty.",
        )

    user_message = Message(
        pet_id=pet.id,
        role="user",
        content=normalized_user_text,
    )
    db.add(user_message)
    db.flush()

    recent_messages = read_recent_messages_for_prompt(db, pet.id)
    pet_reply = call_llm_for_pet_reply(pet, recent_messages)
    pet_message = Message(
        pet_id=pet.id,
        role="pet",
        content=pet_reply,
    )
    db.add(pet_message)
    db.flush()

    return user_message, pet_message
