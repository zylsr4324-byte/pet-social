"""Autonomous social worker driven by APScheduler."""

import json
import logging
import random
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Pet, PetDailyQuota, PetTask
from app.services.llm_client import request_llm_reply
from app.services.pet_social import (
    DAILY_SOCIAL_INITIATION_LIMIT,
    apply_pet_social_presence,
    complete_social_task,
    create_social_message,
    create_social_task,
    estimate_relationship_score,
    generate_social_reply,
    get_conversation_between,
    get_friendship_between,
    get_or_create_conversation,
    read_recent_social_messages,
)
from app.services.pet_stats import apply_decay_and_save, evaluate_social_intent

logger = logging.getLogger(__name__)

AUTO_SOCIAL_TRIGGER_PROBABILITY = 0.4  # Per-pet trigger probability for each tick.
AUTO_SOCIAL_PERCEPTION_WINDOW_MINUTES = 10
AUTO_SOCIAL_PERCEPTION_LIMIT = 3
AUTO_SOCIAL_ACTION_MAX_LENGTH = 120
AUTO_SOCIAL_EMOTION_MAX_LENGTH = 40
AUTO_SOCIAL_BODY_LANGUAGE_MAX_LENGTH = 160
AUTO_SOCIAL_VOCALIZATION_MAX_LENGTH = 80
AUTO_SOCIAL_INTERNAL_THOUGHT_MAX_LENGTH = 200
AUTO_SOCIAL_MAX_TURNS = 3
AUTO_SOCIAL_TARGET_RELATIONSHIP_SCORE_SCALE = 0.08
AUTO_SOCIAL_TARGET_CONVERSATION_BONUS = 1.5
AUTO_SOCIAL_TARGET_RECENT_INCOMING_MESSAGE_BONUS = 2.5
AUTO_SOCIAL_TARGET_SOCIAL_PRESENCE_BONUS = 1.0
AUTO_SOCIAL_TARGET_FRESH_ACTIVITY_WINDOW_MINUTES = 15
AUTO_SOCIAL_TARGET_FRESH_ACTIVITY_BONUS = 1.5
AUTO_SOCIAL_TARGET_INTENT_MATCH_BONUS = 2.0
AUTO_SOCIAL_TARGET_PLAYMATE_ENERGY_MIN = 60
SOCIAL_INTENTS = frozenset(
    {
        "seek_playmate",
        "observe_silently",
        "explore_around",
    }
)
NON_SOCIAL_INTENT_BEHAVIORS = {
    "ignore_social_and_rest": {
        "emotion": "calm",
        "action": "rest",
        "text": "{pet_name} feels hungry or tired, curls up, and rests instead of socializing.",
    },
    "groom_self": {
        "emotion": "calm",
        "action": "groom_self",
        "text": "{pet_name} pauses social attention and focuses on grooming.",
    },
}
AUTONOMOUS_INTENT_DESCRIPTIONS = {
    "ignore_social_and_rest": "你现在又饿又累，身体更想休息和恢复，而不是理会社交。",
    "groom_self": "你现在更在意把自己整理干净，只想舔毛、抖毛或清理身体。",
    "seek_playmate": "你精力充足，又缺少陪伴，现在特别想找谁一起玩。",
    "observe_silently": "你现在偏向先观察环境，安静判断周围是否安全、是否值得靠近。",
    "explore_around": "你现在充满好奇，想主动走动、闻闻四周、看看附近发生了什么。",
}
INTENT_SOCIAL_EMOTIONS = {
    "seek_playmate": "excited",
    "observe_silently": "curious",
    "explore_around": "curious",
}
AUTO_SOCIAL_ACTION_DISPLAY_LABELS = {
    "seek_playmate": "邀请玩耍",
    "observe_silently": "安静观察",
    "explore_around": "四处探索",
    "ignore_social_and_rest": "休息",
    "groom_self": "整理毛发",
    "look_around": "环顾四周",
    "approach": "靠近",
    "reply": "回应",
    "follow_up": "继续回应",
    "respond": "回应",
    "rest": "休息",
    "sniff_target": "谨慎靠近",
    "invite_to_play": "邀请玩耍",
    "check_on_friend": "关心同伴",
    "share_discovery": "分享发现",
    "follow_up_previous_topic": "接着刚才的话题",
    "seek_comfort": "寻求安慰",
    "unknown": "未说明",
}
AUTO_SOCIAL_EMOTION_DISPLAY_LABELS = {
    "calm": "平静",
    "curious": "好奇",
    "guarded": "谨慎",
    "excited": "兴奋",
    "warm": "亲近",
    "friendly": "友好",
    "shy": "害羞",
    "happy": "开心",
    "sad": "低落",
}


# Tick entrypoints
def run_decay_tick() -> None:
    """Apply periodic stat decay to all pets and persist the result."""
    db: Session = SessionLocal()
    try:
        pets = db.query(Pet).all()
        for pet in pets:
            try:
                apply_decay_and_save(pet, db)
            except Exception:
                logger.exception("decay tick failed for pet %s", pet.id)
        db.commit()
        logger.info("decay tick done: %d pets updated", len(pets))
    except Exception:
        db.rollback()
        logger.exception("decay tick session error")
    finally:
        db.close()


def run_auto_social_tick() -> None:
    """Let eligible pets autonomously initiate social interaction on each tick."""
    db: Session = SessionLocal()
    try:
        pets = db.query(Pet).all()
        triggered = 0
        for pet in pets:
            if pet.mood == "uncomfortable":
                continue
            if random.random() > AUTO_SOCIAL_TRIGGER_PROBABILITY:
                continue
            quota = (
                db.query(PetDailyQuota)
                .filter(
                    PetDailyQuota.pet_id == pet.id,
                    PetDailyQuota.date == date.today(),
                )
                .first()
            )
            if quota and quota.social_initiations_used >= DAILY_SOCIAL_INITIATION_LIMIT:
                continue
            try:
                if _do_auto_social_round(db, pet):
                    triggered += 1
            except Exception:
                logger.exception("auto social round failed for pet %s", pet.id)
                db.rollback()
        db.commit()
        logger.info("auto social tick done: %d rounds triggered", triggered)
    except Exception:
        db.rollback()
        logger.exception("auto social tick session error")
    finally:
        db.close()


# Auto social round orchestration
def _do_auto_social_round(db: Session, source_pet: Pet) -> bool:
    intent = evaluate_social_intent(source_pet)

    if intent not in SOCIAL_INTENTS:
        _record_auto_social_self_behavior(db, source_pet, intent)
        return False

    nearby_pets = _find_recently_active_pets(db, source_pet)
    if not nearby_pets:
        _record_auto_social_self_behavior(db, source_pet, "look_around")
        return False

    ranked_nearby_pets = _rank_auto_social_targets(
        db,
        source_pet=source_pet,
        nearby_pets=nearby_pets,
        intent=intent,
    )
    recent_events = _collect_recent_auto_social_events(ranked_nearby_pets)
    llm_context = _build_auto_social_llm_context(
        source_pet=source_pet,
        intent=intent,
        nearby_pets=ranked_nearby_pets,
        recent_events=recent_events,
    )

    try:
        raw_action_response = _request_autonomous_action(llm_context)
        action_decision = _normalize_autonomous_action_decision(
            raw_action_response,
            llm_context,
        )
    except Exception:
        logger.exception(
            "auto social action decision failed for pet %s; using fallback action",
            source_pet.id,
        )
        action_decision = _build_placeholder_social_action(llm_context)
    target_pet = _resolve_action_target(action_decision, ranked_nearby_pets)
    if target_pet is None:
        target_pet = _select_ranked_auto_social_target(
            action_decision,
            ranked_nearby_pets,
        )

    if target_pet is None:
        _record_auto_social_self_behavior(db, source_pet, "look_around")
        return False

    conversation = get_or_create_conversation(db, source_pet.id, target_pet.id)
    action = str(action_decision["action"])
    action_text = _ensure_chinese_auto_social_text(
        _build_auto_social_message(source_pet, target_pet, action_decision),
        speaker=source_pet,
        listener=target_pet,
        action=action,
    )
    emotion = _derive_social_emotion(intent, action_decision)
    create_social_message(
        db,
        conversation.id,
        source_pet.id,
        action_text,
        emotion=_display_auto_social_emotion(emotion),
        action=_display_auto_social_action(action),
    )
    task = create_social_task(
        db,
        target_pet_id=target_pet.id,
        source_pet_id=source_pet.id,
        task_type="greet",
        input_text=action_text,
    )
    apply_pet_social_presence(source_pet, emotion=emotion, action=action)
    transcript = [
        _format_auto_social_transcript_line(
            source_pet,
            action=action,
            emotion=emotion,
            text=action_text,
        ),
    ]
    turn_memory = _initialize_auto_social_turn_memory(
        initiator=source_pet,
        responder=target_pet,
        intent=intent,
        opening_action=action,
        opening_emotion=emotion,
        opening_text=action_text,
    )
    last_speaker = source_pet
    last_listener = target_pet
    last_text = action_text

    for turn_index in range(2, AUTO_SOCIAL_MAX_TURNS + 1):
        if _should_stop_auto_social_turn(
            action_decision if turn_index == 2 else reply_payload,
            speaker=last_speaker,
            listener=last_listener,
            allow_record_then_stop=False,
        ):
            break

        recent_messages = read_recent_social_messages(db, conversation.id)
        reply_payload = _generate_auto_social_turn_reply(
            speaker=last_listener,
            listener=last_speaker,
            recent_messages=recent_messages,
            latest_input=last_text,
            task_type="chat" if turn_index > 2 else "greet",
            memory_context=_build_auto_social_memory_context(
                turn_memory=turn_memory,
                speaker=last_listener,
                listener=last_speaker,
                recent_messages=recent_messages,
            ),
        )

        if _should_stop_auto_social_turn(
            reply_payload,
            speaker=last_listener,
            listener=last_speaker,
            allow_record_then_stop=True,
        ):
            if not _can_record_auto_social_turn(reply_payload):
                break

        raw_reply_text = _truncate_text(_safe_pet_text(reply_payload.get("text")))
        if not raw_reply_text:
            break

        reply_emotion = _safe_pet_text(reply_payload.get("emotion"), default="calm")
        reply_action = _truncate_text(
            _safe_pet_text(reply_payload.get("action"), default="respond"),
            AUTO_SOCIAL_ACTION_MAX_LENGTH,
        )
        reply_text = _ensure_chinese_auto_social_text(
            raw_reply_text,
            speaker=last_listener,
            listener=last_speaker,
            action=reply_action,
        )
        create_social_message(
            db,
            conversation.id,
            last_listener.id,
            reply_text,
            emotion=_display_auto_social_emotion(reply_emotion),
            action=_display_auto_social_action(reply_action),
        )
        apply_pet_social_presence(
            last_listener,
            emotion=reply_emotion,
            action=reply_action,
        )
        transcript.append(
            _format_auto_social_transcript_line(
                last_listener,
                action=reply_action,
                emotion=reply_emotion,
                text=reply_text,
            )
        )
        _remember_auto_social_turn(
            turn_memory,
            pet=last_listener,
            action=reply_action,
            emotion=reply_emotion,
            text=reply_text,
        )
        last_speaker, last_listener = last_listener, last_speaker
        last_text = reply_text

    complete_social_task(
        task,
        "自动社交交流已完成：" + " | ".join(transcript),
    )
    _increment_social_initiation_quota(db, source_pet.id)
    return True


# Multi-turn dialogue helpers
def _generate_auto_social_turn_reply(
    *,
    speaker: Pet,
    listener: Pet,
    recent_messages: list[Any],
    latest_input: str,
    task_type: str,
    memory_context: str | None = None,
) -> dict[str, str]:
    try:
        return generate_social_reply(
            target_pet=speaker,
            source_pet=listener,
            recent_messages=recent_messages,
            latest_input=latest_input,
            task_type=task_type,
            memory_context=memory_context,
        )
    except Exception:
        logger.exception(
            "auto social reply generation failed for pet %s responding to pet %s",
            getattr(speaker, "id", None),
            getattr(listener, "id", None),
        )
        return {"emotion": "calm", "action": "rest", "text": ""}


def _should_stop_auto_social_turn(
    action_payload: dict[str, Any],
    *,
    speaker: Pet,
    listener: Pet,
    allow_record_then_stop: bool,
) -> bool:
    action = _safe_pet_text(action_payload.get("action")).lower()
    text = _safe_pet_text(action_payload.get("text"))
    body_language = _safe_pet_text(action_payload.get("body_language"))
    vocalization = _safe_pet_text(action_payload.get("vocalization"))
    should_continue = _coerce_optional_bool(action_payload.get("should_continue"))
    target_pet_id = _coerce_optional_int(action_payload.get("target_pet_id"))

    if action == "rest":
        return True
    if should_continue is False:
        return not allow_record_then_stop or not text
    if not text and not body_language and not vocalization:
        return True
    if target_pet_id is not None and target_pet_id != getattr(listener, "id", None):
        return True
    if target_pet_id is None and not text:
        return True

    return False


def _can_record_auto_social_turn(action_payload: dict[str, Any]) -> bool:
    action = _safe_pet_text(action_payload.get("action")).lower()
    text = _safe_pet_text(action_payload.get("text"))
    body_language = _safe_pet_text(action_payload.get("body_language"))
    vocalization = _safe_pet_text(action_payload.get("vocalization"))

    if action == "rest":
        return False
    if not text and not body_language and not vocalization:
        return False
    return True


def _format_auto_social_transcript_line(
    pet: Pet,
    *,
    action: str,
    emotion: str,
    text: str,
) -> str:
    normalized_action = _display_auto_social_action(action)
    normalized_emotion = _display_auto_social_emotion(emotion)
    normalized_text = _truncate_text(_safe_pet_text(text))
    pet_name = _display_auto_social_pet_name(pet, default="这只宠物")
    return (
        f"{pet_name}[动作={normalized_action}，情绪={normalized_emotion}]："
        f"{normalized_text}"
    )


def _display_auto_social_action(action: Any) -> str:
    normalized_action = _truncate_text(_safe_pet_text(action, default="unknown"))
    if _contains_ascii_letters(normalized_action):
        return AUTO_SOCIAL_ACTION_DISPLAY_LABELS.get(normalized_action, "回应")
    return AUTO_SOCIAL_ACTION_DISPLAY_LABELS.get(normalized_action, normalized_action)


def _display_auto_social_emotion(emotion: Any) -> str:
    normalized_emotion = _truncate_text(_safe_pet_text(emotion, default="calm"))
    if _contains_ascii_letters(normalized_emotion):
        return AUTO_SOCIAL_EMOTION_DISPLAY_LABELS.get(normalized_emotion, "平静")
    return AUTO_SOCIAL_EMOTION_DISPLAY_LABELS.get(normalized_emotion, normalized_emotion)


def _display_auto_social_pet_name(pet: Pet, *, default: str) -> str:
    pet_name = _truncate_text(_safe_pet_text(getattr(pet, "pet_name", None), default=default))
    if _contains_ascii_letters(pet_name):
        return default
    return pet_name


def _ensure_chinese_auto_social_text(
    text: str,
    *,
    speaker: Pet,
    listener: Pet,
    action: str,
) -> str:
    normalized_text = _truncate_text(_safe_pet_text(text))
    if normalized_text and not _contains_ascii_letters(normalized_text):
        return normalized_text

    action_label = _display_auto_social_action(action)
    speaker_name = _display_auto_social_pet_name(speaker, default="这只宠物")
    listener_name = _display_auto_social_pet_name(listener, default="对方")
    if action_label == "邀请玩耍":
        return _truncate_text(f"{speaker_name}主动邀请{listener_name}一起玩。")
    if action_label == "安静观察":
        return _truncate_text(f"{speaker_name}安静地观察{listener_name}。")
    if action_label == "四处探索":
        return _truncate_text(f"{speaker_name}在附近探索，并向{listener_name}打招呼。")
    if action_label == "休息":
        return _truncate_text(f"{speaker_name}决定先休息一下。")
    return _truncate_text(f"{speaker_name}对{listener_name}做出了回应。")


def _initialize_auto_social_turn_memory(
    *,
    initiator: Pet,
    responder: Pet,
    intent: str,
    opening_action: str,
    opening_emotion: str,
    opening_text: str,
) -> dict[str, Any]:
    turn_memory = {
        "initiator_name": _display_auto_social_pet_name(initiator, default="发起宠物"),
        "responder_name": _display_auto_social_pet_name(responder, default="回应宠物"),
        "intent": intent,
        "recent_turns": [],
        "latest_by_pet_id": {},
    }
    _remember_auto_social_turn(
        turn_memory,
        pet=initiator,
        action=opening_action,
        emotion=opening_emotion,
        text=opening_text,
    )
    return turn_memory


def _remember_auto_social_turn(
    turn_memory: dict[str, Any],
    *,
    pet: Pet,
    action: str,
    emotion: str,
    text: str,
) -> None:
    turn_summary = {
        "pet_id": pet.id,
        "pet_name": _display_auto_social_pet_name(pet, default="这只宠物"),
        "action": _display_auto_social_action(action),
        "emotion": _display_auto_social_emotion(emotion),
        "text": _truncate_text(_safe_pet_text(text)),
    }
    recent_turns = turn_memory.setdefault("recent_turns", [])
    recent_turns.append(turn_summary)
    turn_memory["recent_turns"] = recent_turns[-4:]
    latest_by_pet_id = turn_memory.setdefault("latest_by_pet_id", {})
    latest_by_pet_id[pet.id] = turn_summary


def _build_auto_social_memory_context(
    *,
    turn_memory: dict[str, Any],
    speaker: Pet,
    listener: Pet,
    recent_messages: list[Any],
) -> str:
    recent_turns = turn_memory.get("recent_turns", [])
    latest_by_pet_id = turn_memory.get("latest_by_pet_id", {})
    latest_speaker_turn = latest_by_pet_id.get(speaker.id)
    latest_listener_turn = latest_by_pet_id.get(listener.id)
    latest_message_preview = ""
    if recent_messages:
        latest_message_preview = _truncate_text(
            _safe_pet_text(getattr(recent_messages[-1], "content", None))
        )

    topic_hint = _build_auto_social_topic_hint(recent_turns)
    speaker_name = _display_auto_social_pet_name(speaker, default="当前宠物")
    listener_name = _display_auto_social_pet_name(listener, default="对方")
    lines = [
        "短期互动记忆",
        (
            f"- 本轮由 {turn_memory.get('initiator_name', 'Unknown')} 主动发起，"
            f"起因意图是 {_display_auto_social_action(turn_memory.get('intent', 'observe_silently'))}。"
        ),
        f"- 当前轮到 {speaker_name} 接 {listener_name} 的话。",
    ]
    if latest_message_preview:
        lines.append(f"- 最新一句是：{latest_message_preview}")
    if topic_hint:
        lines.append(f"- 当前话题线索：{topic_hint}")
    if latest_listener_turn is not None:
        lines.append(
            f"- {listener_name} 刚刚的状态：动作={latest_listener_turn['action']}，"
            f"情绪={latest_listener_turn['emotion']}。"
        )
    if latest_speaker_turn is not None:
        lines.append(
            f"- {speaker_name} 刚刚的状态：动作={latest_speaker_turn['action']}，"
            f"情绪={latest_speaker_turn['emotion']}。"
        )
    if recent_turns:
        lines.append("- 最近几句互动：")
        for turn in recent_turns[-4:]:
            lines.append(
                f"  - {turn['pet_name']}[动作={turn['action']}，情绪={turn['emotion']}]：{turn['text']}"
            )
    lines.append(
        "- 尽量接住上一句里的具体内容、动作或情绪，不要只重复泛泛问候。"
    )
    return "\n".join(lines)


def _build_auto_social_topic_hint(recent_turns: list[dict[str, Any]]) -> str:
    fragments: list[str] = []
    for turn in recent_turns[-3:]:
        text = _safe_pet_text(turn.get("text"))
        if not text:
            continue
        fragments.append(text[:24])
    return " / ".join(fragments)


# Target selection helpers
def _rank_auto_social_targets(
    db: Session,
    *,
    source_pet: Pet,
    nearby_pets: list[Pet],
    intent: str,
) -> list[Pet]:
    scored_candidates: list[tuple[float, int, Pet]] = []

    for index, candidate in enumerate(nearby_pets):
        score = _score_auto_social_target(
            db,
            source_pet=source_pet,
            candidate=candidate,
            intent=intent,
        )
        scored_candidates.append((score, -index, candidate))

    scored_candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [candidate for _, _, candidate in scored_candidates]


def _score_auto_social_target(
    db: Session,
    *,
    source_pet: Pet,
    candidate: Pet,
    intent: str,
) -> float:
    friendship = get_friendship_between(db, source_pet.id, candidate.id)
    conversation = get_conversation_between(db, source_pet.id, candidate.id)
    recent_messages = read_recent_social_messages(db, conversation.id) if conversation else []
    relationship_score = estimate_relationship_score(
        friendship,
        recent_messages,
        source_pet.id,
    )

    score = relationship_score * AUTO_SOCIAL_TARGET_RELATIONSHIP_SCORE_SCALE

    if conversation is not None:
        score += AUTO_SOCIAL_TARGET_CONVERSATION_BONUS

    if recent_messages and recent_messages[-1].sender_pet_id == candidate.id:
        score += AUTO_SOCIAL_TARGET_RECENT_INCOMING_MESSAGE_BONUS

    if _safe_pet_text(getattr(candidate, "social_action", None)) or _safe_pet_text(
        getattr(candidate, "social_emotion", None)
    ):
        score += AUTO_SOCIAL_TARGET_SOCIAL_PRESENCE_BONUS

    stats_updated_at = getattr(candidate, "stats_updated_at", None)
    if _is_recent_auto_social_activity(stats_updated_at):
        score += AUTO_SOCIAL_TARGET_FRESH_ACTIVITY_BONUS

    if _target_matches_auto_social_intent(candidate, intent):
        score += AUTO_SOCIAL_TARGET_INTENT_MATCH_BONUS

    return score


def _is_recent_auto_social_activity(value: Any) -> bool:
    if not isinstance(value, datetime):
        return False

    candidate_time = value
    if candidate_time.tzinfo is None:
        candidate_time = candidate_time.replace(tzinfo=timezone.utc)

    return candidate_time >= datetime.now(timezone.utc) - timedelta(
        minutes=AUTO_SOCIAL_TARGET_FRESH_ACTIVITY_WINDOW_MINUTES
    )


def _target_matches_auto_social_intent(candidate: Pet, intent: str) -> bool:
    if intent == "seek_playmate":
        return getattr(candidate, "energy", 0) >= AUTO_SOCIAL_TARGET_PLAYMATE_ENERGY_MIN

    if intent == "observe_silently":
        return bool(_safe_pet_text(getattr(candidate, "social_action", None)))

    if intent == "explore_around":
        return _safe_pet_text(getattr(candidate, "social_emotion", None)) in {
            "curious",
            "excited",
            "warm",
        }

    return False


def _find_recently_active_pets(db: Session, source_pet: Pet) -> list[Pet]:
    active_after = datetime.now(timezone.utc) - timedelta(
        minutes=AUTO_SOCIAL_PERCEPTION_WINDOW_MINUTES
    )
    return (
        db.query(Pet)
        .filter(
            Pet.id != source_pet.id,
            Pet.stats_updated_at >= active_after,
        )
        .order_by(Pet.stats_updated_at.desc(), Pet.id.desc())
        .limit(AUTO_SOCIAL_PERCEPTION_LIMIT)
        .all()
    )


# LLM context and prompt helpers
def _build_auto_social_llm_context(
    *,
    source_pet: Pet,
    intent: str,
    nearby_pets: list[Pet],
    recent_events: list[str],
) -> dict[str, Any]:
    return {
        "source_pet": _serialize_pet_context(source_pet),
        "intent": intent,
        "perception": {
            "window_minutes": AUTO_SOCIAL_PERCEPTION_WINDOW_MINUTES,
            "nearby_pets": [_serialize_pet_context(pet) for pet in nearby_pets],
            "recent_events": list(recent_events),
        },
        "system_prompt": build_autonomous_action_prompt(
            source_pet,
            intent,
            nearby_pets,
            recent_events,
        ),
        "allowed_action_shape": {
            "action_type": "string",
            "text": "string",
            "target_pet_id": "int|null",
            "reason": "string",
            "should_continue": "boolean",
            "emotion": "string",
            "metadata": {
                "body_language": "string",
                "vocalization": "string",
                "internal_thought": "string",
            },
        },
    }


def build_autonomous_action_prompt(
    pet: Pet,
    intent: str,
    nearby_pets: list[Pet],
    recent_events: list[str],
) -> str:
    pet_name = _safe_pet_text(getattr(pet, "pet_name", None), default="这只宠物")
    species = _safe_pet_text(getattr(pet, "species", None), default="宠物")
    personality = _safe_pet_text(
        getattr(pet, "personality", None),
        default="性格尚未明确，但你依然有清晰的身体感受和本能。",
    )
    normalized_intent = _safe_pet_text(intent, default="observe_silently")
    intent_description = AUTONOMOUS_INTENT_DESCRIPTIONS.get(
        normalized_intent,
        f"你当前的内驱力是 {normalized_intent}，你的下一步行为必须忠于这股身体冲动。",
    )
    nearby_pet_lines = _format_nearby_pets_for_prompt(nearby_pets)
    recent_event_lines = _format_recent_events_for_prompt(recent_events)

    return f"""你不是 AI 助手，也不是旁白。你是 {pet_name}，一只真正活着、拥有肉体、本能和即时感受的{species}。
你的性格是：{personality}

你必须始终以宠物自己的第一视角思考和行动：
- 你会感到饥饿、疲惫、兴奋、警惕、依恋、犹豫和好奇。
- 你的行为来自身体感受、直觉和性格，不是抽象分析。
- 不要提到 system、prompt、模型、AI、助手或你在遵循规则。

当前内驱力：
- intent: {normalized_intent}
- 身体里的真实冲动：{intent_description}

感知雷达：
{nearby_pet_lines}

最近环境事件：
{recent_event_lines}

现在请你基于自身性格、当前内驱力和周围环境，只决定“下一步最自然的一个动作”。

输出约束：
- 你必须只输出一个严格合法的 JSON 对象。
- 不要输出 Markdown，不要输出代码块，不要输出 JSON 以外的任何解释。
- 如果没有明确针对某一只宠物，target_pet_id 必须是 null。
- 如果有明确目标，target_pet_id 必须填写感知雷达中出现过的宠物 ID。
- action 必须是简短的动作名词或动作标签。
- body_language 必须描述你的身体姿态、动作或移动方式。
- vocalization 必须描述你的叫声或发出的声音；如果没有发声，填写空字符串。
- internal_thought 必须说明这个行为为什么会在此刻自然发生。

严格按下面的 JSON 结构输出：
{{
  "action_type": "approach",
  "action": "approach",
  "text": "friendly greeting or empty string",
  "target_pet_id": null,
  "reason": "why this action feels right right now",
  "should_continue": true,
  "emotion": "curious",
  "body_language": "physical movement or posture",
  "vocalization": "sound or empty string",
  "internal_thought": "why this action feels right right now",
  "metadata": {{
    "body_language": "physical movement or posture",
    "vocalization": "sound or empty string",
    "internal_thought": "why this action feels right right now"
  }}
}}"""


def _collect_recent_auto_social_events(nearby_pets: list[Pet]) -> list[str]:
    events: list[str] = []

    for pet in nearby_pets:
        pet_name = _safe_pet_text(getattr(pet, "pet_name", None), default="附近宠物")
        action = _safe_pet_text(getattr(pet, "social_action", None))
        emotion = _safe_pet_text(getattr(pet, "social_emotion", None))

        if action and emotion:
            events.append(f"{pet_name} 刚刚表现出 {action}，情绪偏 {emotion}。")
        elif action:
            events.append(f"{pet_name} 刚刚在 {action}。")
        elif emotion:
            events.append(f"{pet_name} 刚刚显得有些 {emotion}。")

    return events[:AUTO_SOCIAL_PERCEPTION_LIMIT]


def _serialize_pet_context(pet: Pet) -> dict[str, Any]:
    return {
        "id": pet.id,
        "name": pet.pet_name,
        "species": pet.species,
        "personality": pet.personality,
        "mood": pet.mood,
        "social_emotion": pet.social_emotion,
        "social_action": pet.social_action,
        "stats": {
            "fullness": pet.fullness,
            "hydration": pet.hydration,
            "affection": pet.affection,
            "energy": pet.energy,
            "cleanliness": pet.cleanliness,
            "stats_updated_at": _isoformat_or_none(pet.stats_updated_at),
        },
    }


# LLM request and fallback helpers
def _build_placeholder_social_action(llm_context: dict[str, Any]) -> dict[str, Any]:
    source_pet = llm_context["source_pet"]
    source_name = str(source_pet["name"])
    intent = str(llm_context["intent"])
    nearby_pets = llm_context["perception"]["nearby_pets"]
    target_pet = nearby_pets[0] if nearby_pets else None
    target_name = str(target_pet["name"]) if target_pet is not None else None
    target_id = target_pet["id"] if target_pet is not None else None

    if intent == "seek_playmate":
        text = (
            f"{source_name}精神一振，主动邀请{target_name}一起玩。"
            if target_name
            else f"{source_name}环顾四周，想找个伙伴一起玩。"
        )
        return {
            "action": "seek_playmate",
            "action_type": "seek_playmate",
            "emotion": "excited",
            "body_language": "ears_forward_tail_wagging",
            "vocalization": "friendly chirp",
            "internal_thought": "I have energy and want someone's attention right now.",
            "reason": "I have energy and want someone's attention right now.",
            "should_continue": True,
            "metadata": {
                "body_language": "ears_forward_tail_wagging",
                "vocalization": "friendly chirp",
                "internal_thought": "I have energy and want someone's attention right now.",
            },
            "target_pet_id": target_id,
            "text": text,
        }

    if intent == "observe_silently":
        text = (
            f"{source_name}安静地在旁边观察{target_name}。"
            if target_name
            else f"{source_name}安静地观察着房间里的动静。"
        )
        return {
            "action": "observe_silently",
            "action_type": "observe_silently",
            "emotion": "curious",
            "body_language": "still_body_soft_gaze",
            "vocalization": "",
            "internal_thought": "I want to read the room before I get any closer.",
            "reason": "I want to read the room before I get any closer.",
            "should_continue": target_id is not None,
            "metadata": {
                "body_language": "still_body_soft_gaze",
                "vocalization": "",
                "internal_thought": "I want to read the room before I get any closer.",
            },
            "target_pet_id": target_id,
            "text": text,
        }

    text = (
        f"{source_name}在附近探索，并好奇地向{target_name}打招呼。"
        if target_name
        else f"{source_name}在附近探索，竖起耳朵听有没有其他宠物。"
    )
    return {
        "action": "explore_around",
        "action_type": "explore_around",
        "emotion": "curious",
        "body_language": "relaxed_steps_head_turning",
        "vocalization": "soft hello",
        "internal_thought": "The area feels interesting and I want to check it out.",
        "reason": "The area feels interesting and I want to check it out.",
        "should_continue": target_id is not None,
        "metadata": {
            "body_language": "relaxed_steps_head_turning",
            "vocalization": "soft hello",
            "internal_thought": "The area feels interesting and I want to check it out.",
        },
        "target_pet_id": target_id,
        "text": text,
    }


def _request_autonomous_action(llm_context: dict[str, Any]) -> dict[str, Any]:
    source_pet = llm_context.get("source_pet", {})
    pet_id = source_pet.get("id")
    intent = llm_context.get("intent")

    logger.info(
        "requesting autonomous action via llm for pet %s with intent %s",
        pet_id,
        intent,
    )

    try:
        raw_action_response = request_llm_reply(
            [
                {
                    "role": "developer",
                    "content": str(llm_context.get("system_prompt", "")).strip(),
                },
                {
                    "role": "user",
                    "content": (
                        "请只返回严格 JSON。优先使用 action_type、text、target_pet_id、"
                        "reason、should_continue、emotion、metadata 的新格式。"
                        "旧格式 action、text、target_pet_id、emotion、body_language、"
                        "vocalization、internal_thought 也可以接受。"
                    ),
                },
            ]
        )
    except Exception:
        logger.exception(
            "autonomous action llm request failed for pet %s; using placeholder action",
            pet_id,
        )
        return _build_placeholder_social_action(llm_context)

    action_decision = _try_normalize_autonomous_action_decision(
        raw_action_response,
        llm_context,
    )
    if action_decision is None:
        logger.warning(
            "autonomous action llm reply could not be parsed for pet %s; using placeholder action",
            pet_id,
        )
        return _build_placeholder_social_action(llm_context)

    logger.info(
        "autonomous action llm reply parsed for pet %s action=%s target_pet_id=%s",
        pet_id,
        action_decision["action"],
        action_decision.get("target_pet_id"),
    )
    return action_decision


def _resolve_action_target(
    action_decision: dict[str, Any], nearby_pets: list[Pet]
) -> Pet | None:
    target_pet_id = action_decision.get("target_pet_id")
    for pet in nearby_pets:
        if pet.id == target_pet_id:
            return pet
    return None


def _select_ranked_auto_social_target(
    action_decision: dict[str, Any],
    ranked_nearby_pets: list[Pet],
) -> Pet | None:
    if not ranked_nearby_pets:
        return None

    action = _safe_pet_text(action_decision.get("action")).lower()
    should_continue = _coerce_optional_bool(action_decision.get("should_continue"))
    text = _safe_pet_text(action_decision.get("text"))

    if action == "rest":
        return None
    if should_continue is False and not text:
        return None

    return ranked_nearby_pets[0]


# Autonomous action normalization helpers
def _normalize_autonomous_action_decision(
    raw_action_response: Any,
    llm_context: dict[str, Any],
) -> dict[str, Any]:
    normalized = _try_normalize_autonomous_action_decision(
        raw_action_response,
        llm_context,
    )
    if normalized is None:
        return _build_placeholder_social_action(llm_context)
    return normalized


def _try_normalize_autonomous_action_decision(
    raw_action_response: Any,
    llm_context: dict[str, Any],
) -> dict[str, Any] | None:
    try:
        payload = _coerce_action_payload_dict(raw_action_response)
    except Exception:
        logger.exception(
            "auto social action payload coercion failed; using fallback action"
        )
        return None

    if payload is None:
        logger.warning(
            "auto social action payload is not valid JSON/object; using fallback action"
        )
        return None

    payload = _normalize_autonomous_action_payload(payload)

    nearby_pet_ids = {
        pet_context.get("id")
        for pet_context in llm_context.get("perception", {}).get("nearby_pets", [])
        if isinstance(pet_context, dict)
    }

    target_pet_id = _coerce_optional_int(payload.get("target_pet_id"))
    action = _truncate_text(
        _safe_pet_text(payload.get("action")),
        AUTO_SOCIAL_ACTION_MAX_LENGTH,
    )

    if not action:
        logger.warning(
            "auto social action payload is missing required fields; using fallback action"
        )
        return None

    if (
        target_pet_id is not None
        and nearby_pet_ids
        and target_pet_id not in nearby_pet_ids
    ):
        logger.warning(
            "auto social action payload targets a non-nearby pet; clearing target"
        )
        target_pet_id = None

    emotion = _truncate_text(
        _safe_pet_text(payload.get("emotion")).lower(),
        AUTO_SOCIAL_EMOTION_MAX_LENGTH,
    )
    body_language = _truncate_text(
        _safe_pet_text(payload.get("body_language"), default="still but attentive"),
        AUTO_SOCIAL_BODY_LANGUAGE_MAX_LENGTH,
    )
    vocalization = _truncate_text(
        _safe_pet_text(payload.get("vocalization")),
        AUTO_SOCIAL_VOCALIZATION_MAX_LENGTH,
    )
    internal_thought = _truncate_text(
        _safe_pet_text(
            payload.get("internal_thought"),
            default=f"I want to {action.replace('_', ' ')} right now.",
        ),
        AUTO_SOCIAL_INTERNAL_THOUGHT_MAX_LENGTH,
    )
    reason = _truncate_text(
        _safe_pet_text(payload.get("reason"), default=internal_thought),
        AUTO_SOCIAL_INTERNAL_THOUGHT_MAX_LENGTH,
    )
    text = _truncate_text(_safe_pet_text(payload.get("text")))
    should_continue = _coerce_optional_bool(payload.get("should_continue"))
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}

    if should_continue is None:
        should_continue = target_pet_id is not None and action != "rest"

    return {
        "target_pet_id": target_pet_id,
        "action": action,
        "action_type": action,
        "emotion": emotion,
        "body_language": body_language,
        "vocalization": vocalization,
        "internal_thought": internal_thought,
        "reason": reason,
        "should_continue": should_continue,
        "metadata": metadata,
        "text": text,
    }


def _normalize_autonomous_action_payload(
    payload: dict[str, Any],
) -> dict[str, Any]:
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    action = payload.get("action")
    if not isinstance(action, str) or not action.strip():
        action = payload.get("action_type")

    body_language = payload.get("body_language")
    if not isinstance(body_language, str) or not body_language.strip():
        body_language = metadata.get("body_language")

    vocalization = payload.get("vocalization")
    if not isinstance(vocalization, str):
        vocalization = metadata.get("vocalization")

    internal_thought = payload.get("internal_thought")
    if not isinstance(internal_thought, str) or not internal_thought.strip():
        internal_thought = metadata.get("internal_thought")
    if not isinstance(internal_thought, str) or not internal_thought.strip():
        internal_thought = payload.get("reason")

    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        reason = internal_thought

    return {
        "target_pet_id": payload.get("target_pet_id"),
        "action": action,
        "emotion": payload.get("emotion"),
        "body_language": body_language,
        "vocalization": vocalization,
        "internal_thought": internal_thought,
        "reason": reason,
        "should_continue": payload.get("should_continue"),
        "metadata": metadata,
        "text": payload.get("text"),
    }


def _coerce_action_payload_dict(raw_action_response: Any) -> dict[str, Any] | None:
    if isinstance(raw_action_response, dict):
        return raw_action_response

    if hasattr(raw_action_response, "model_dump"):
        parsed = raw_action_response.model_dump()
        return parsed if isinstance(parsed, dict) else None

    if hasattr(raw_action_response, "dict"):
        parsed = raw_action_response.dict()
        return parsed if isinstance(parsed, dict) else None

    object_fields = _coerce_action_payload_object(raw_action_response)
    if object_fields is not None:
        return object_fields

    if not isinstance(raw_action_response, str):
        return None

    json_candidate = _extract_json_object_candidate(raw_action_response)
    try:
        parsed = json.loads(json_candidate)
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def _coerce_action_payload_object(raw_action_response: Any) -> dict[str, Any] | None:
    fields = (
        "target_pet_id",
        "action",
        "action_type",
        "emotion",
        "body_language",
        "vocalization",
        "internal_thought",
        "reason",
        "should_continue",
        "metadata",
        "text",
    )
    payload = {
        field: getattr(raw_action_response, field)
        for field in fields
        if hasattr(raw_action_response, field)
    }
    return payload or None


def _extract_json_object_candidate(raw_action_response: str) -> str:
    cleaned = raw_action_response.strip()
    if not cleaned:
        return cleaned

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3 and lines[0].startswith("```") and lines[-1] == "```":
            return "\n".join(lines[1:-1]).strip()

    object_start = cleaned.find("{")
    object_end = cleaned.rfind("}")
    if object_start != -1 and object_end > object_start:
        return cleaned[object_start : object_end + 1].strip()

    return cleaned


def _derive_social_emotion(intent: str, action_decision: dict[str, Any]) -> str:
    explicit_emotion = _safe_pet_text(action_decision.get("emotion"))
    if explicit_emotion:
        return explicit_emotion

    return INTENT_SOCIAL_EMOTIONS.get(intent, "calm")


def _build_auto_social_message(
    source_pet: Pet,
    target_pet: Pet,
    action_decision: dict[str, Any],
) -> str:
    raw_text = _safe_pet_text(action_decision.get("text"))
    if raw_text:
        return _truncate_text(raw_text)

    action = str(action_decision["action"]).replace("_", " ")
    body_language = _safe_pet_text(action_decision.get("body_language"))
    vocalization = _safe_pet_text(action_decision.get("vocalization"))

    segments = [f"{source_pet.pet_name}对{target_pet.pet_name}表现出{action}。"]
    if body_language:
        segments.append(f"身体动作：{body_language}。")
    if vocalization:
        segments.append(f"声音：{vocalization}。")

    return _truncate_text(" ".join(segments))


# Low-level text and coercion helpers
def _coerce_optional_int(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_optional_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False

    return None


# Task persistence helpers
def _record_auto_social_self_behavior(
    db: Session,
    source_pet: Pet,
    intent: str,
) -> PetTask:
    behavior = NON_SOCIAL_INTENT_BEHAVIORS.get(
        intent,
        {
            "emotion": "curious",
            "action": intent,
            "text": "{pet_name} notices the room but does not find a clear social target.",
        },
    )
    action = str(behavior["action"])
    emotion = str(behavior["emotion"])
    text = _truncate_text(str(behavior["text"]).format(pet_name=source_pet.pet_name))
    task = create_social_task(
        db,
        target_pet_id=source_pet.id,
        source_pet_id=None,
        task_type="chat",
        input_text=text,
    )
    complete_social_task(task, text)
    apply_pet_social_presence(source_pet, emotion=emotion, action=action)
    return task


def _increment_social_initiation_quota(db: Session, pet_id: int) -> None:
    quota = (
        db.query(PetDailyQuota)
        .filter(
            PetDailyQuota.pet_id == pet_id,
            PetDailyQuota.date == date.today(),
        )
        .first()
    )

    if quota is not None:
        quota.social_initiations_used += 1
        return

    db.add(
        PetDailyQuota(
            pet_id=pet_id,
            date=date.today(),
            llm_calls_used=0,
            social_initiations_used=1,
        )
    )


def _truncate_text(text: str, limit: int = 500) -> str:
    normalized = text.strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip()


def _format_nearby_pets_for_prompt(nearby_pets: list[Pet]) -> str:
    if not nearby_pets:
        return "- 附近暂时没有明确可见的其他宠物。"

    return "\n".join(
        (
            f"- ID {pet.id}: "
            f"{_safe_pet_text(getattr(pet, 'pet_name', None), default='未命名宠物')} "
            f"({_safe_pet_text(getattr(pet, 'species', None), default='未知种类')})"
        )
        for pet in nearby_pets
    )


def _format_recent_events_for_prompt(recent_events: list[str]) -> str:
    normalized_events = [
        _safe_pet_text(event)
        for event in recent_events
        if _safe_pet_text(event)
    ]
    if not normalized_events:
        return "- 刚刚周围没有特别明显的事件发生，环境比较平静。"

    return "\n".join(f"- {event}" for event in normalized_events)


def _safe_pet_text(value: object, *, default: str = "") -> str:
    if not isinstance(value, str):
        return default

    normalized = value.strip()
    return normalized or default


def _contains_ascii_letters(value: str) -> bool:
    return any(("a" <= char.lower() <= "z") for char in value)


def _isoformat_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
