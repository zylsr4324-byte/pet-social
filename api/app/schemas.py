from datetime import datetime

from pydantic import BaseModel, Field


class PetBase(BaseModel):
    petName: str
    species: str
    color: str
    size: str
    personality: str
    specialTraits: str


class PetCreate(PetBase):
    pass


class PetUpdate(PetBase):
    pass


class PetResponse(BaseModel):
    id: int
    petName: str
    species: str
    color: str
    size: str
    personality: str
    specialTraits: str
    createdAt: datetime
    updatedAt: datetime


class PetDetailResponse(BaseModel):
    message: str
    pet: PetResponse


class PetChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class PetChatResponse(BaseModel):
    message: str
    petName: str
    reply: str
