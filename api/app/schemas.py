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


class PetListResponse(BaseModel):
    message: str
    pets: list[PetResponse]


class MessageResponse(BaseModel):
    id: int
    pet_id: int
    role: str
    content: str
    created_at: datetime


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]


class PetChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class PetChatResponse(BaseModel):
    user_message: MessageResponse
    pet_message: MessageResponse


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime


class AuthRegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6, max_length=128)


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6, max_length=128)


class AuthRegisterResponse(BaseModel):
    message: str
    user: UserResponse


class AuthLoginResponse(BaseModel):
    message: str
    token: str
    user: UserResponse


class AuthLogoutResponse(BaseModel):
    message: str


class AuthMeResponse(BaseModel):
    message: str
    user: UserResponse
