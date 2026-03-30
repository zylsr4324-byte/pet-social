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


class PetStatusResponse(BaseModel):
    fullness: int
    hydration: int
    affection: int
    energy: int
    cleanliness: int
    mood: str


class PetActionResponse(BaseModel):
    message: str
    status: PetStatusResponse


class FriendshipCreateRequest(BaseModel):
    targetPetId: int
    message: str | None = Field(default=None, max_length=500)


class SocialSendRequest(BaseModel):
    targetPetId: int
    message: str = Field(min_length=1, max_length=500)


class ExternalA2ASendRequest(BaseModel):
    agentUrl: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1, max_length=500)


class PetTaskResponse(BaseModel):
    id: int
    targetPetId: int
    sourcePetId: int | None
    taskType: str
    state: str
    inputText: str
    outputText: str | None
    externalTaskId: str | None = None
    agentUrl: str | None = None
    createdAt: datetime
    completedAt: datetime | None


class SocialMessageResponse(BaseModel):
    id: int
    conversationId: int
    senderPetId: int
    content: str
    createdAt: datetime


class SocialConversationResponse(BaseModel):
    conversationId: int
    withPet: PetResponse
    messages: list[SocialMessageResponse]


class SocialMessageListResponse(BaseModel):
    message: str
    conversation: SocialConversationResponse


class FriendshipResponse(BaseModel):
    friend: PetResponse
    status: str
    initiatedBy: int
    direction: str
    conversationId: int | None
    lastMessagePreview: str | None
    createdAt: datetime
    acceptedAt: datetime | None


class FriendshipListResponse(BaseModel):
    message: str
    friends: list[FriendshipResponse]


class FriendshipActionResponse(BaseModel):
    message: str
    friendship: FriendshipResponse


class SocialCandidateResponse(BaseModel):
    pet: PetResponse
    friendshipStatus: str | None
    direction: str
    conversationId: int | None
    canRequest: bool
    canChat: bool


class SocialCandidateListResponse(BaseModel):
    message: str
    candidates: list[SocialCandidateResponse]


class SocialTaskHistoryItemResponse(BaseModel):
    task: PetTaskResponse
    counterpartPet: PetResponse | None


class SocialTaskListResponse(BaseModel):
    message: str
    tasks: list[SocialTaskHistoryItemResponse]


class SocialSendResponse(BaseModel):
    message: str
    task: PetTaskResponse
    sentMessage: SocialMessageResponse
    replyMessage: SocialMessageResponse
    conversationId: int
    targetPet: PetResponse


class ExternalA2ARemoteResultResponse(BaseModel):
    agentUrl: str
    taskId: str | None
    state: str
    replyText: str | None


class ExternalA2ASendResponse(BaseModel):
    message: str
    task: PetTaskResponse
    remote: ExternalA2ARemoteResultResponse


class SocialRoundResponse(BaseModel):
    message: str
    task: PetTaskResponse
    sentMessage: SocialMessageResponse
    replyMessage: SocialMessageResponse
    conversationId: int
    targetPet: PetResponse
