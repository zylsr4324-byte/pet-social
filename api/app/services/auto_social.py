"""自主社交 worker — 由 APScheduler 定时调用。"""

import json
import logging
import random
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Pet, PetDailyQuota, PetTask
from app.services.pet_social import (
    DAILY_SOCIAL_INITIATION_LIMIT,
    apply_pet_social_presence,
    complete_social_task,
    create_social_message,
    create_social_task,
    get_or_create_conversation,
)
from app.services.pet_stats import apply_decay_and_save, evaluate_social_intent

logger = logging.getLogger(__name__)

AUTO_SOCIAL_TRIGGER_PROBABILITY = 0.4  # 每只宠物本轮触发概率
AUTO_SOCIAL_PERCEPTION_WINDOW_MINUTES = 10
AUTO_SOCIAL_PERCEPTION_LIMIT = 3
AUTO_SOCIAL_ACTION_MAX_LENGTH = 120
AUTO_SOCIAL_EMOTION_MAX_LENGTH = 40
AUTO_SOCIAL_BODY_LANGUAGE_MAX_LENGTH = 160
AUTO_SOCIAL_VOCALIZATION_MAX_LENGTH = 80
AUTO_SOCIAL_INTERNAL_THOUGHT_MAX_LENGTH = 200
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


def run_decay_tick() -> None:
    """每 10 分钟：对所有宠物执行状态衰减并写库。"""
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
    """每 30 分钟：随机让满足条件的宠物自动发起社交。"""
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


def _do_auto_social_round(db: Session, source_pet: Pet) -> bool:
    intent = evaluate_social_intent(source_pet)

    if intent not in SOCIAL_INTENTS:
        _record_auto_social_self_behavior(db, source_pet, intent)
        return False

    nearby_pets = _find_recently_active_pets(db, source_pet)
    if not nearby_pets:
        _record_auto_social_self_behavior(db, source_pet, "look_around")
        return False

    recent_events = _collect_recent_auto_social_events(nearby_pets)
    llm_context = _build_auto_social_llm_context(
        source_pet=source_pet,
        intent=intent,
        nearby_pets=nearby_pets,
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
    target_pet = _resolve_action_target(action_decision, nearby_pets)

    if target_pet is None:
        _record_auto_social_self_behavior(db, source_pet, "look_around")
        return False

    action_text = _build_auto_social_message(source_pet, target_pet, action_decision)
    emotion = _derive_social_emotion(intent, action_decision)
    action = str(action_decision["action"])
    conversation = get_or_create_conversation(db, source_pet.id, target_pet.id)
    create_social_message(
        db,
        conversation.id,
        source_pet.id,
        action_text,
        emotion=emotion,
        action=action,
    )
    task = create_social_task(
        db,
        target_pet_id=target_pet.id,
        source_pet_id=source_pet.id,
        task_type="greet",
        input_text=action_text,
    )
    complete_social_task(
        task,
        f"Recorded initiator action '{action}'. Waiting for target pet heartbeat.",
    )
    apply_pet_social_presence(source_pet, emotion=emotion, action=action)
    _increment_social_initiation_quota(db, source_pet.id)
    return True


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
            "target_pet_id": "int|null",
            "action": "string",
            "body_language": "string",
            "vocalization": "string",
            "internal_thought": "string",
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
  "target_pet_id": null,
  "action": "action_name",
  "body_language": "physical movement or posture",
  "vocalization": "sound or empty string",
  "internal_thought": "why this action feels right right now"
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
            f"{source_name} perks up and invites {target_name} to play."
            if target_name
            else f"{source_name} looks around for someone to play with."
        )
        return {
            "action": "seek_playmate",
            "emotion": "excited",
            "body_language": "ears_forward_tail_wagging",
            "vocalization": "friendly chirp",
            "internal_thought": "I have energy and want someone's attention right now.",
            "target_pet_id": target_id,
            "text": text,
        }

    if intent == "observe_silently":
        text = (
            f"{source_name} quietly observes {target_name} from nearby."
            if target_name
            else f"{source_name} quietly observes the room."
        )
        return {
            "action": "observe_silently",
            "emotion": "curious",
            "body_language": "still_body_soft_gaze",
            "vocalization": "",
            "internal_thought": "I want to read the room before I get any closer.",
            "target_pet_id": target_id,
            "text": text,
        }

    text = (
        f"{source_name} explores the area and gives {target_name} a curious greeting."
        if target_name
        else f"{source_name} explores the area and listens for nearby pets."
    )
    return {
        "action": "explore_around",
        "emotion": "curious",
        "body_language": "relaxed_steps_head_turning",
        "vocalization": "soft hello",
        "internal_thought": "The area feels interesting and I want to check it out.",
        "target_pet_id": target_id,
        "text": text,
    }


def _request_autonomous_action(llm_context: dict[str, Any]) -> Any:
    # TODO: Call LLM to decide next action based on context.
    return _build_placeholder_social_action(llm_context)


def _resolve_action_target(
    action_decision: dict[str, Any], nearby_pets: list[Pet]
) -> Pet | None:
    target_pet_id = action_decision.get("target_pet_id")
    for pet in nearby_pets:
        if pet.id == target_pet_id:
            return pet
    return None


def _normalize_autonomous_action_decision(
    raw_action_response: Any,
    llm_context: dict[str, Any],
) -> dict[str, Any]:
    try:
        payload = _coerce_action_payload_dict(raw_action_response)
    except Exception:
        logger.exception(
            "auto social action payload coercion failed; using fallback action"
        )
        return _build_placeholder_social_action(llm_context)

    if payload is None:
        logger.warning(
            "auto social action payload is not valid JSON/object; using fallback action"
        )
        return _build_placeholder_social_action(llm_context)

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
        return _build_placeholder_social_action(llm_context)

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
    text = _truncate_text(_safe_pet_text(payload.get("text")))

    return {
        "target_pet_id": target_pet_id,
        "action": action,
        "emotion": emotion,
        "body_language": body_language,
        "vocalization": vocalization,
        "internal_thought": internal_thought,
        "text": text,
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
        "emotion",
        "body_language",
        "vocalization",
        "internal_thought",
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

    segments = [f"{source_pet.pet_name} shows {action} toward {target_pet.pet_name}."]
    if body_language:
        segments.append(f"Body language: {body_language}.")
    if vocalization:
        segments.append(f"Sound: {vocalization}.")

    return _truncate_text(" ".join(segments))


def _coerce_optional_int(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


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


def _isoformat_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
