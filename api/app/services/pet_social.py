from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import (
    Pet,
    PetConversation,
    PetDailyQuota,
    PetFriendship,
    PetSocialMessage,
    PetTask,
)
from app.schemas import (
    FriendshipResponse,
    PetResponse,
    PetTaskResponse,
    SocialCandidateResponse,
    SocialMessageResponse,
    SocialTaskHistoryItemResponse,
)
from app.services.llm_client import request_llm_reply
from app.services.pet_personality import (
    build_personality_style_rules,
    build_pet_profile_summary,
    build_turn_specific_guard,
    infer_temperament_label,
)
from app.services.pets import build_pet_response, get_pet_or_404
from app.services.reply_validation import (
    ROLE_RETRY_LIMIT,
    STYLE_RETRY_LIMIT,
    reply_conflicts_with_personality,
    reply_mentions_forbidden_identity,
)

SOCIAL_CONTEXT_LIMIT = 8
DAILY_SOCIAL_INITIATION_LIMIT = 5
FRIEND_REQUEST_COOLDOWN_HOURS = 24


def normalize_pet_pair(pet_a_id: int, pet_b_id: int) -> tuple[int, int]:
    if pet_a_id == pet_b_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="宠物不能和自己建立社交关系。",
        )

    return (pet_a_id, pet_b_id) if pet_a_id < pet_b_id else (pet_b_id, pet_a_id)


def get_counterpart_pet(friendship: PetFriendship, current_pet_id: int, db: Session) -> Pet:
    counterpart_id = (
        friendship.pet_b_id
        if friendship.pet_a_id == current_pet_id
        else friendship.pet_a_id
    )
    return get_pet_or_404(db, counterpart_id)


def get_friendship_between(
    db: Session, pet_a_id: int, pet_b_id: int
) -> PetFriendship | None:
    pair_a, pair_b = normalize_pet_pair(pet_a_id, pet_b_id)
    return (
        db.query(PetFriendship)
        .filter(PetFriendship.pet_a_id == pair_a, PetFriendship.pet_b_id == pair_b)
        .first()
    )


def get_conversation_between(
    db: Session, pet_a_id: int, pet_b_id: int
) -> PetConversation | None:
    pair_a, pair_b = normalize_pet_pair(pet_a_id, pet_b_id)
    return (
        db.query(PetConversation)
        .filter(PetConversation.pet_a_id == pair_a, PetConversation.pet_b_id == pair_b)
        .first()
    )


def get_or_create_conversation(
    db: Session, pet_a_id: int, pet_b_id: int
) -> PetConversation:
    conversation = get_conversation_between(db, pet_a_id, pet_b_id)
    if conversation is not None:
        return conversation

    pair_a, pair_b = normalize_pet_pair(pet_a_id, pet_b_id)
    conversation = PetConversation(pet_a_id=pair_a, pet_b_id=pair_b)
    db.add(conversation)
    db.flush()
    return conversation


def read_recent_social_messages(
    db: Session, conversation_id: int, limit: int = SOCIAL_CONTEXT_LIMIT
) -> list[PetSocialMessage]:
    recent_messages = (
        db.query(PetSocialMessage)
        .filter(PetSocialMessage.conversation_id == conversation_id)
        .order_by(PetSocialMessage.created_at.desc(), PetSocialMessage.id.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(recent_messages))


def create_social_message(
    db: Session, conversation_id: int, sender_pet_id: int, content: str
) -> PetSocialMessage:
    message = PetSocialMessage(
        conversation_id=conversation_id,
        sender_pet_id=sender_pet_id,
        content=content.strip(),
    )
    db.add(message)
    db.flush()
    return message


def create_social_task(
    db: Session,
    *,
    target_pet_id: int,
    source_pet_id: int | None,
    task_type: str,
    input_text: str,
) -> PetTask:
    task = PetTask(
        target_pet_id=target_pet_id,
        source_pet_id=source_pet_id,
        task_type=task_type,
        state="pending",
        input_text=input_text.strip(),
    )
    db.add(task)
    db.flush()
    return task


def complete_social_task(task: PetTask, output_text: str) -> PetTask:
    task.state = "completed"
    task.output_text = output_text.strip()
    task.completed_at = datetime.now(timezone.utc)
    return task


def build_pet_task_response(task: PetTask) -> PetTaskResponse:
    return PetTaskResponse(
        id=task.id,
        targetPetId=task.target_pet_id,
        sourcePetId=task.source_pet_id,
        taskType=task.task_type,
        state=task.state,
        inputText=task.input_text,
        outputText=task.output_text,
        externalTaskId=task.a2a_task_id,
        agentUrl=task.source_agent_url,
        createdAt=task.created_at,
        completedAt=task.completed_at,
    )


def build_social_message_response(message: PetSocialMessage) -> SocialMessageResponse:
    return SocialMessageResponse(
        id=message.id,
        conversationId=message.conversation_id,
        senderPetId=message.sender_pet_id,
        content=message.content,
        createdAt=message.created_at,
    )


def build_friendship_direction(friendship: PetFriendship, current_pet_id: int) -> str:
    if friendship.status == "accepted":
        return "accepted"
    return "outgoing" if friendship.initiated_by == current_pet_id else "incoming"


def read_last_conversation_message(
    db: Session, conversation_id: int | None
) -> PetSocialMessage | None:
    if conversation_id is None:
        return None

    return (
        db.query(PetSocialMessage)
        .filter(PetSocialMessage.conversation_id == conversation_id)
        .order_by(PetSocialMessage.created_at.desc(), PetSocialMessage.id.desc())
        .first()
    )


def build_friendship_response(
    db: Session, friendship: PetFriendship, current_pet_id: int
) -> FriendshipResponse:
    counterpart_pet = get_counterpart_pet(friendship, current_pet_id, db)
    conversation = get_conversation_between(db, current_pet_id, counterpart_pet.id)
    last_message = read_last_conversation_message(
        db, conversation.id if conversation is not None else None
    )
    return FriendshipResponse(
        friend=build_pet_response(counterpart_pet),
        status=friendship.status,
        initiatedBy=friendship.initiated_by,
        direction=build_friendship_direction(friendship, current_pet_id),
        conversationId=conversation.id if conversation is not None else None,
        lastMessagePreview=last_message.content if last_message is not None else None,
        createdAt=friendship.created_at,
        acceptedAt=friendship.accepted_at,
    )


def build_social_candidate_response(
    db: Session, current_pet_id: int, pet: Pet
) -> SocialCandidateResponse:
    friendship = get_friendship_between(db, current_pet_id, pet.id)
    conversation = get_conversation_between(db, current_pet_id, pet.id)
    friendship_status = friendship.status if friendship is not None else None
    direction = (
        build_friendship_direction(friendship, current_pet_id)
        if friendship is not None
        else "none"
    )
    can_request = friendship is None or friendship.status == "rejected"
    can_chat = friendship is not None and friendship.status == "accepted"

    return SocialCandidateResponse(
        pet=build_pet_response(pet),
        friendshipStatus=friendship_status,
        direction=direction,
        conversationId=conversation.id if conversation is not None else None,
        canRequest=can_request,
        canChat=can_chat,
    )


def build_social_task_history_item(
    db: Session, task: PetTask, current_pet_id: int
) -> SocialTaskHistoryItemResponse:
    counterpart_pet: PetResponse | None = None
    counterpart_id: int | None = None

    if task.source_pet_id == current_pet_id:
        counterpart_id = task.target_pet_id
    elif task.target_pet_id == current_pet_id:
        counterpart_id = task.source_pet_id

    if counterpart_id is not None:
        counterpart = get_pet_or_404(db, counterpart_id)
        counterpart_pet = build_pet_response(counterpart)

    return SocialTaskHistoryItemResponse(
        task=build_pet_task_response(task),
        counterpartPet=counterpart_pet,
    )


def get_or_create_pet_daily_quota(
    db: Session, pet_id: int, quota_date: date | None = None
) -> PetDailyQuota:
    target_date = quota_date or datetime.now(timezone.utc).date()
    quota = (
        db.query(PetDailyQuota)
        .filter(PetDailyQuota.pet_id == pet_id, PetDailyQuota.date == target_date)
        .first()
    )

    if quota is not None:
        return quota

    quota = PetDailyQuota(
        pet_id=pet_id,
        date=target_date,
        llm_calls_used=0,
        social_initiations_used=0,
    )
    db.add(quota)
    db.flush()
    return quota


def consume_daily_social_initiation_quota(
    db: Session,
    pet_id: int,
    *,
    quota_date: date | None = None,
    limit: int = DAILY_SOCIAL_INITIATION_LIMIT,
) -> PetDailyQuota:
    quota = get_or_create_pet_daily_quota(db, pet_id, quota_date=quota_date)

    if quota.social_initiations_used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"当前宠物今天已达到{limit}次主动社交上限，请明天再试。",
        )

    quota.social_initiations_used += 1
    db.flush()
    return quota


def is_friend_request_in_cooldown(
    friendship: PetFriendship,
    *,
    current_time: datetime | None = None,
) -> bool:
    if friendship.status != "rejected" or friendship.created_at is None:
        return False

    request_created_at = friendship.created_at
    if request_created_at.tzinfo is None:
        request_created_at = request_created_at.replace(tzinfo=timezone.utc)

    now = current_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    cooldown_deadline = request_created_at + timedelta(
        hours=FRIEND_REQUEST_COOLDOWN_HOURS
    )
    return now < cooldown_deadline


def ensure_friendship_can_chat(friendship: PetFriendship | None) -> None:
    if friendship is None or friendship.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="当前只能和已接受好友关系的宠物直接聊天，请先完成好友请求处理。",
        )


def ensure_friendship_request_allowed(
    friendship: PetFriendship | None,
    current_pet_id: int,
    *,
    current_time: datetime | None = None,
) -> None:
    if friendship is None:
        return

    if friendship.status == "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="这两只宠物已经是好友了，可以直接进入聊天。",
        )

    if friendship.status == "pending" and friendship.initiated_by == current_pet_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="好友请求已经发出，当前只能等待对方处理。",
        )

    if friendship.status == "pending" and friendship.initiated_by != current_pet_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="对方已经先发来好友请求，请先接受或拒绝。",
        )

    if friendship.status == "rejected" and is_friend_request_in_cooldown(
        friendship,
        current_time=current_time,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="\u540c\u4e00\u5bf9\u5ba0\u7269 24 \u5c0f\u65f6\u5185\u53ea\u80fd\u53d1\u8d77 1 \u6b21\u597d\u53cb\u8bf7\u6c42\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002",
        )


def build_friend_request_message(source_pet: Pet, target_pet: Pet) -> str:
    temperament = infer_temperament_label(source_pet.personality)
    if "活泼" in temperament:
        return f"嗨，{target_pet.pet_name}，我是{source_pet.pet_name}，想和你做朋友。"
    if "高冷" in temperament:
        return f"我是{source_pet.pet_name}。如果你愿意，我们可以认识一下。"
    if "黏人" in temperament:
        return f"{target_pet.pet_name}，你好呀，我是{source_pet.pet_name}，想多和你聊聊。"
    if "好奇" in temperament:
        return f"你好，{target_pet.pet_name}。我叫{source_pet.pet_name}，想认识认识你。"
    return f"你好，{target_pet.pet_name}，我是{source_pet.pet_name}，想和你交个朋友。"


def build_round_opening(source_pet: Pet, target_pet: Pet, task_type: str) -> str:
    if task_type == "greet":
        return build_friend_request_message(source_pet, target_pet)

    temperament = infer_temperament_label(source_pet.personality)
    if "活泼" in temperament:
        return f"{target_pet.pet_name}，今天想和你聊聊天，你现在在做什么呀？"
    if "高冷" in temperament:
        return f"{target_pet.pet_name}，路过和你打个招呼。"
    if "黏人" in temperament:
        return f"{target_pet.pet_name}，我来找你玩啦，你愿意陪我聊两句吗？"
    if "好奇" in temperament:
        return f"{target_pet.pet_name}，我有点好奇你今天过得怎么样。"
    return f"{target_pet.pet_name}，你好呀，想和你聊两句。"


def build_social_fallback_reply(target_pet: Pet, source_pet: Pet, task_type: str) -> str:
    temperament = infer_temperament_label(target_pet.personality)

    if task_type == "greet":
        if "高冷" in temperament:
            return f"我听见了，{source_pet.pet_name}。先慢慢认识吧。"
        if "活泼" in temperament:
            return f"你好呀，{source_pet.pet_name}！认识你也不错。"
        if "黏人" in temperament:
            return f"你好，{source_pet.pet_name}，我愿意和你说说话。"
        return f"你好，{source_pet.pet_name}，很高兴认识你。"

    if "高冷" in temperament:
        return f"{source_pet.pet_name}，我在听。你继续说。"
    if "活泼" in temperament:
        return f"{source_pet.pet_name}，我在呀，继续聊吧。"
    if "黏人" in temperament:
        return f"{source_pet.pet_name}，你来找我，我还挺开心的。"
    if "好奇" in temperament:
        return f"{source_pet.pet_name}，这事听起来有点意思，你再说说。"
    return f"{source_pet.pet_name}，我听到了，我们继续聊。"


def build_social_llm_input(
    *,
    target_pet: Pet,
    source_pet: Pet,
    recent_messages: list[PetSocialMessage],
    latest_input: str,
    task_type: str,
    strict_mode: bool = False,
) -> list[dict[str, str]]:
    task_hint = {
        "chat": "你们已经开始对话了，继续自然接话。",
        "greet": "对方在主动打招呼或表达想认识你，请自然回应。",
        "befriend": "对方在发起好友请求，请给出符合性格的回应。",
    }.get(task_type, "请自然回应对方。")

    developer_prompt = (
        "你不是 AI 助手，也不是客服，你就是下面设定里的宠物。\n"
        "不要提到 system、prompt、模型、AI 或助手。\n\n"
        f"{build_pet_profile_summary(target_pet)}\n\n"
        "你现在是在和另一只宠物交流，不是在和人类交流。\n"
        f"对方宠物资料：\n{build_pet_profile_summary(source_pet)}\n\n"
        f"{build_personality_style_rules(target_pet, strict_mode)}\n"
        "- 回复保持宠物口吻，像在和另一只宠物对话。\n"
        "- 1 到 2 句话，尽量控制在 80 字以内。\n"
        f"- {task_hint}\n"
        f"{build_turn_specific_guard(target_pet, latest_input, strict_mode)}"
    )

    input_messages: list[dict[str, str]] = [
        {"role": "developer", "content": developer_prompt}
    ]

    for message in recent_messages:
        role = "assistant" if message.sender_pet_id == target_pet.id else "user"
        input_messages.append({"role": role, "content": message.content})

    return input_messages


def generate_social_reply(
    *,
    target_pet: Pet,
    source_pet: Pet,
    recent_messages: list[PetSocialMessage],
    latest_input: str,
    task_type: str,
) -> str:
    retry_limit = max(ROLE_RETRY_LIMIT, STYLE_RETRY_LIMIT)

    try:
        reply_text = request_llm_reply(
            build_social_llm_input(
                target_pet=target_pet,
                source_pet=source_pet,
                recent_messages=recent_messages,
                latest_input=latest_input,
                task_type=task_type,
            )
        )
    except HTTPException:
        return build_social_fallback_reply(target_pet, source_pet, task_type)

    if (
        not reply_mentions_forbidden_identity(reply_text)
        and not reply_conflicts_with_personality(target_pet, reply_text)
    ):
        return reply_text

    for _ in range(retry_limit):
        try:
            strict_reply = request_llm_reply(
                build_social_llm_input(
                    target_pet=target_pet,
                    source_pet=source_pet,
                    recent_messages=recent_messages,
                    latest_input=latest_input,
                    task_type=task_type,
                    strict_mode=True,
                )
            )
        except HTTPException:
            return build_social_fallback_reply(target_pet, source_pet, task_type)

        if (
            not reply_mentions_forbidden_identity(strict_reply)
            and not reply_conflicts_with_personality(target_pet, strict_reply)
        ):
            return strict_reply

    return build_social_fallback_reply(target_pet, source_pet, task_type)


def choose_social_round_target(db: Session, source_pet: Pet) -> tuple[Pet, str]:
    accepted_friendships = (
        db.query(PetFriendship)
        .filter(
            or_(
                PetFriendship.pet_a_id == source_pet.id,
                PetFriendship.pet_b_id == source_pet.id,
            ),
            PetFriendship.status == "accepted",
        )
        .order_by(PetFriendship.accepted_at.desc(), PetFriendship.created_at.desc())
        .all()
    )

    if accepted_friendships:
        friend = get_counterpart_pet(accepted_friendships[0], source_pet.id, db)
        return friend, "chat"

    candidates = (
        db.query(Pet)
        .filter(Pet.id != source_pet.id)
        .order_by(Pet.created_at.desc(), Pet.id.desc())
        .all()
    )

    for candidate in candidates:
        friendship = get_friendship_between(db, source_pet.id, candidate.id)
        if friendship is None:
            return candidate, "greet"
        if friendship.status == "rejected" and not is_friend_request_in_cooldown(
            friendship
        ):
            return candidate, "greet"

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="当前没有可继续推进的新社交对象，请先处理待接收请求，或等待对方回应。",
    )


def prepare_round_friendship(
    db: Session, source_pet: Pet, target_pet: Pet, task_type: str
) -> None:
    if task_type != "greet":
        return

    friendship = get_friendship_between(db, source_pet.id, target_pet.id)
    ensure_friendship_request_allowed(friendship, source_pet.id)
    pair_a, pair_b = normalize_pet_pair(source_pet.id, target_pet.id)

    if friendship is None:
        friendship = PetFriendship(
            pet_a_id=pair_a,
            pet_b_id=pair_b,
            initiated_by=source_pet.id,
            status="pending",
        )
        db.add(friendship)
        db.flush()
        return

    friendship.initiated_by = source_pet.id
    friendship.status = "pending"
    friendship.accepted_at = None
    friendship.created_at = datetime.now(timezone.utc)


def get_social_tasks_for_pet(db: Session, pet_id: int) -> list[PetTask]:
    return (
        db.query(PetTask)
        .filter(or_(PetTask.source_pet_id == pet_id, PetTask.target_pet_id == pet_id))
        .order_by(PetTask.created_at.desc(), PetTask.id.desc())
        .all()
    )


def build_social_round_result_message(target_pet: Pet, task_type: str) -> str:
    if task_type == "chat":
        return f"已和好友{target_pet.pet_name}完成一轮互动。"
    return f"已向{target_pet.pet_name}发起一轮破冰招呼，关系等待对方处理。"
