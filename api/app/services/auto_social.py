"""自主社交 worker — 由 APScheduler 定时调用。"""

import logging
import random
from datetime import date, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Pet, PetConversation, PetDailyQuota, PetSocialMessage, PetTask
from app.services.pet_social import (
    DAILY_SOCIAL_INITIATION_LIMIT,
    build_round_opening,
    choose_social_round_target,
    complete_social_task,
    generate_social_reply,
    read_recent_social_messages,
    prepare_round_friendship,
)
from app.services.pet_stats import apply_decay_and_save

logger = logging.getLogger(__name__)

AUTO_SOCIAL_TRIGGER_PROBABILITY = 0.4  # 每只宠物本轮触发概率


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
                _do_auto_social_round(db, pet)
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


def _do_auto_social_round(db: Session, source_pet: Pet) -> None:
    try:
        target_pet, task_type = choose_social_round_target(db, source_pet)
    except Exception:
        return  # 没有合适目标

    opening = build_round_opening(source_pet, target_pet, task_type)

    task = PetTask(
        source_pet_id=source_pet.id,
        target_pet_id=target_pet.id,
        task_type=task_type,
        state="pending",
        input_text=opening,
    )
    db.add(task)
    db.flush()

    # 找或创建对话
    from sqlalchemy import or_
    conversation = (
        db.query(PetConversation)
        .filter(
            or_(
                (PetConversation.pet_a_id == source_pet.id) & (PetConversation.pet_b_id == target_pet.id),
                (PetConversation.pet_a_id == target_pet.id) & (PetConversation.pet_b_id == source_pet.id),
            )
        )
        .first()
    )
    if conversation is None:
        conversation = PetConversation(
            pet_a_id=min(source_pet.id, target_pet.id),
            pet_b_id=max(source_pet.id, target_pet.id),
        )
        db.add(conversation)
        db.flush()

    recent_messages = read_recent_social_messages(db, conversation.id)

    sent_msg = PetSocialMessage(
        conversation_id=conversation.id,
        sender_pet_id=source_pet.id,
        content=opening,
    )
    db.add(sent_msg)
    db.flush()

    reply_text = generate_social_reply(
        target_pet=target_pet,
        source_pet=source_pet,
        recent_messages=recent_messages,
        latest_input=opening,
        task_type=task_type,
    )

    reply_msg = PetSocialMessage(
        conversation_id=conversation.id,
        sender_pet_id=target_pet.id,
        content=reply_text,
    )
    db.add(reply_msg)

    complete_social_task(task, reply_text)

    prepare_round_friendship(db, source_pet, target_pet, task_type)

    # 更新配额
    if quota := db.query(PetDailyQuota).filter(
        PetDailyQuota.pet_id == source_pet.id,
        PetDailyQuota.date == date.today(),
    ).first():
        quota.social_initiations_used += 1
    else:
        db.add(PetDailyQuota(
            pet_id=source_pet.id,
            date=date.today(),
            llm_calls_used=0,
            social_initiations_used=1,
        ))
