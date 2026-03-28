from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Message, Pet
from app.schemas import MessageResponse, PetResponse


def build_pet_response(pet: Pet) -> PetResponse:
    return PetResponse(
        id=pet.id,
        petName=pet.pet_name,
        species=pet.species,
        color=pet.color,
        size=pet.size,
        personality=pet.personality,
        specialTraits=pet.special_traits,
        createdAt=pet.created_at,
        updatedAt=pet.updated_at,
    )


def build_message_response(message: Message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        pet_id=message.pet_id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
    )


def get_pet_or_404(db: Session, pet_id: int) -> Pet:
    pet = db.get(Pet, pet_id)

    if pet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 id 为 {pet_id} 的宠物资料。",
        )

    return pet


def get_owned_pet_or_404(db: Session, pet_id: int, user_id: int) -> Pet:
    pet = (
        db.query(Pet)
        .filter(Pet.id == pet_id, Pet.owner_id == user_id)
        .first()
    )

    if pet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 id 为 {pet_id} 的宠物资料。",
        )

    return pet
