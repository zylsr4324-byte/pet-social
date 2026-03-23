from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import create_tables, get_db
from app.models import Pet
from app.schemas import (
    PetChatRequest,
    PetChatResponse,
    PetCreate,
    PetDetailResponse,
    PetResponse,
    PetUpdate,
)

settings = get_settings()
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_tables()


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "message": "Pet Agent Social API 已启动。",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health_check() -> dict[str, object]:
    return {
        "status": "ok",
        "message": "后端服务运行正常。",
        "app": settings.app_name,
        "environment": settings.environment,
        "services": {
            "postgres": {
                "host": settings.postgres_host,
                "port": settings.postgres_port,
                "database": settings.postgres_db,
            },
            "redis": {
                "host": settings.redis_host,
                "port": settings.redis_port,
            },
        },
    }


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


def get_pet_or_404(db: Session, pet_id: int) -> Pet:
    pet = db.get(Pet, pet_id)

    if pet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 id 为 {pet_id} 的宠物资料。",
        )

    return pet


def build_fake_pet_reply(pet: Pet, user_message: str) -> str:
    cleaned_message = user_message.strip()
    reply_templates = [
        f"我是{pet.pet_name}，我刚刚认真听到你说“{cleaned_message}”啦。",
        f"{pet.pet_name}正歪着脑袋看你，像是在回应：“{cleaned_message}”。",
        f"{pet.pet_name}轻轻晃了晃尾巴，已经把你说的“{cleaned_message}”记住了。",
    ]
    template_index = (len(cleaned_message) + len(pet.pet_name)) % len(
        reply_templates
    )

    return reply_templates[template_index]


@app.post("/pets", response_model=PetDetailResponse, status_code=status.HTTP_201_CREATED)
def create_pet(payload: PetCreate, db: Session = Depends(get_db)) -> PetDetailResponse:
    pet = Pet(
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
            detail="宠物资料保存失败，请稍后再试。",
        ) from error

    return PetDetailResponse(
        message="宠物资料创建成功。",
        pet=build_pet_response(pet),
    )


@app.get("/pets/{pet_id}", response_model=PetDetailResponse)
def read_pet(pet_id: int, db: Session = Depends(get_db)) -> PetDetailResponse:
    pet = get_pet_or_404(db, pet_id)

    return PetDetailResponse(
        message="宠物资料读取成功。",
        pet=build_pet_response(pet),
    )


@app.put("/pets/{pet_id}", response_model=PetDetailResponse)
def update_pet(
    pet_id: int, payload: PetUpdate, db: Session = Depends(get_db)
) -> PetDetailResponse:
    pet = get_pet_or_404(db, pet_id)

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
            detail="宠物资料更新失败，请稍后再试。",
        ) from error

    return PetDetailResponse(
        message="宠物资料更新成功。",
        pet=build_pet_response(pet),
    )


@app.post("/pets/{pet_id}/chat", response_model=PetChatResponse)
def chat_with_pet(
    pet_id: int, payload: PetChatRequest, db: Session = Depends(get_db)
) -> PetChatResponse:
    pet = get_pet_or_404(db, pet_id)
    user_message = payload.message.strip()

    if not user_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="消息内容不能为空。",
        )

    return PetChatResponse(
        message="宠物回复生成成功。",
        petName=pet.pet_name,
        reply=build_fake_pet_reply(pet, user_message),
    )
