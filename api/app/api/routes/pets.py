from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Message, Pet, User
from app.schemas import (
    MessageListResponse,
    PetActionResponse,
    PetChatRequest,
    PetChatResponse,
    PetCreate,
    PetDetailResponse,
    PetStatusResponse,
    PetUpdate,
)
from app.services.auth import get_current_user
from app.services.pet_chat import call_llm_for_pet_reply, read_recent_messages_for_prompt
from app.services.pet_stats import (
    apply_decay_and_save,
    calculate_mood,
    clamp,
    project_current_stats,
)
from app.services.pets import (
    build_message_response,
    build_pet_response,
    get_owned_pet_or_404,
)

router = APIRouter(tags=["pets"])


@router.post("/pets", response_model=PetDetailResponse, status_code=status.HTTP_201_CREATED)
def create_pet(
    payload: PetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetDetailResponse:
    pet = Pet(
        owner_id=current_user.id,
        pet_name=payload.petName,
        species=payload.species,
        color=payload.color,
        size=payload.size,
        personality=payload.personality,
        special_traits=payload.specialTraits,
    )

    try:
        db.add(pet)
        db.commit()
        db.refresh(pet)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="宠物资料保存失败了，请稍后再试。",
        ) from error

    return PetDetailResponse(
        message="宠物资料创建成功。",
        pet=build_pet_response(pet),
    )


@router.get("/pets/{pet_id}", response_model=PetDetailResponse)
def read_pet(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetDetailResponse:
    pet = get_owned_pet_or_404(db, pet_id, current_user.id)

    return PetDetailResponse(
        message="宠物资料读取成功。",
        pet=build_pet_response(pet),
    )


@router.put("/pets/{pet_id}", response_model=PetDetailResponse)
def update_pet(
    pet_id: int,
    payload: PetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetDetailResponse:
    pet = get_owned_pet_or_404(db, pet_id, current_user.id)

    pet.pet_name = payload.petName
    pet.species = payload.species
    pet.color = payload.color
    pet.size = payload.size
    pet.personality = payload.personality
    pet.special_traits = payload.specialTraits

    try:
        db.add(pet)
        db.commit()
        db.refresh(pet)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="宠物资料更新失败了，请稍后再试。",
        ) from error

    return PetDetailResponse(
        message="宠物资料更新成功。",
        pet=build_pet_response(pet),
    )


@router.get("/pets/{pet_id}/messages", response_model=MessageListResponse)
def read_pet_messages(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageListResponse:
    get_owned_pet_or_404(db, pet_id, current_user.id)
    messages = (
        db.query(Message)
        .filter(Message.pet_id == pet_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )

    return MessageListResponse(
        messages=[build_message_response(message) for message in messages]
    )


@router.delete("/pets/{pet_id}/messages")
def delete_pet_messages(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    get_owned_pet_or_404(db, pet_id, current_user.id)

    try:
        db.query(Message).filter(Message.pet_id == pet_id).delete(
            synchronize_session=False
        )
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="清空聊天记录失败了，请稍后再试。",
        ) from error

    return {
        "message": "聊天记录已清空，现在可以重新开始聊天了。",
    }


@router.post("/pets/{pet_id}/chat", response_model=PetChatResponse)
def chat_with_pet(
    pet_id: int,
    payload: PetChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetChatResponse:
    pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    user_text = payload.message.strip()

    if not user_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="消息内容不能为空。",
        )

    user_message = Message(
        pet_id=pet.id,
        role="user",
        content=user_text,
    )

    try:
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
        db.commit()
        db.refresh(user_message)
        db.refresh(pet_message)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="聊天消息保存失败了，请稍后再试。",
        ) from error

    return PetChatResponse(
        user_message=build_message_response(user_message),
        pet_message=build_message_response(pet_message),
    )


# ---------------------------------------------------------------------------
# 宠物状态 & 互动
# ---------------------------------------------------------------------------

def _build_status_response(pet: Pet, projected: dict) -> PetStatusResponse:
    mood = calculate_mood(
        projected["fullness"],
        projected["hydration"],
        projected["energy"],
        projected["cleanliness"],
        projected["affection"],
    )
    return PetStatusResponse(
        fullness=projected["fullness"],
        hydration=projected["hydration"],
        affection=projected["affection"],
        energy=projected["energy"],
        cleanliness=projected["cleanliness"],
        mood=mood,
    )


@router.get("/pets/{pet_id}/status", response_model=PetStatusResponse)
def get_pet_status(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetStatusResponse:
    pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    projected = project_current_stats(pet)
    return _build_status_response(pet, projected)


def _do_pet_action(
    pet_id: int,
    db: Session,
    current_user: User,
    action_label: str,
    apply_effect: callable,
) -> PetActionResponse:
    pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    apply_decay_and_save(pet, db)
    apply_effect(pet)
    pet.mood = calculate_mood(
        pet.fullness, pet.hydration, pet.energy, pet.cleanliness, pet.affection
    )

    try:
        db.commit()
        db.refresh(pet)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{action_label}失败了，请稍后再试。",
        ) from error

    projected = project_current_stats(pet)
    return PetActionResponse(
        message=f"{action_label}成功。",
        status=_build_status_response(pet, projected),
    )


@router.post("/pets/{pet_id}/feed", response_model=PetActionResponse)
def feed_pet(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetActionResponse:
    from datetime import datetime, timezone

    def apply(pet: Pet) -> None:
        pet.fullness = clamp(pet.fullness + 30)
        pet.last_fed_at = datetime.now(timezone.utc)
        pet.last_interaction_at = datetime.now(timezone.utc)

    return _do_pet_action(pet_id, db, current_user, "喂食", apply)


@router.post("/pets/{pet_id}/drink", response_model=PetActionResponse)
def give_pet_water(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetActionResponse:
    from datetime import datetime, timezone

    def apply(pet: Pet) -> None:
        pet.hydration = clamp(pet.hydration + 35)
        pet.last_interaction_at = datetime.now(timezone.utc)

    return _do_pet_action(pet_id, db, current_user, "喂水", apply)


@router.post("/pets/{pet_id}/play", response_model=PetActionResponse)
def play_with_pet(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetActionResponse:
    from datetime import datetime, timezone

    def apply(pet: Pet) -> None:
        pet.affection = clamp(pet.affection + 10)
        pet.energy = clamp(pet.energy - 15)
        pet.last_interaction_at = datetime.now(timezone.utc)

    return _do_pet_action(pet_id, db, current_user, "玩耍", apply)


@router.post("/pets/{pet_id}/clean", response_model=PetActionResponse)
def clean_pet(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetActionResponse:
    from datetime import datetime, timezone

    def apply(pet: Pet) -> None:
        pet.cleanliness = clamp(pet.cleanliness + 40)
        pet.last_interaction_at = datetime.now(timezone.utc)

    return _do_pet_action(pet_id, db, current_user, "清洁", apply)
