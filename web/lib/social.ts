import { type ApiPet, isPetProfile } from "./pet";

export type SocialCandidate = {
  pet: ApiPet;
  friendshipStatus: string | null;
  direction: string;
  conversationId: number | null;
  canRequest: boolean;
  canChat: boolean;
};

export type SocialCandidateListResponse = {
  message: string;
  candidates: SocialCandidate[];
};

export type Friendship = {
  friend: ApiPet;
  status: string;
  initiatedBy: number;
  direction: string;
  conversationId: number | null;
  lastMessagePreview: string | null;
  createdAt: string;
  acceptedAt: string | null;
};

export type FriendshipListResponse = {
  message: string;
  friends: Friendship[];
};

export type FriendshipActionResponse = {
  message: string;
  friendship: Friendship;
};

export type SocialTask = {
  id: number;
  targetPetId: number;
  sourcePetId: number | null;
  taskType: string;
  state: string;
  inputText: string;
  outputText: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type SocialTaskHistoryItem = {
  task: SocialTask;
  counterpartPet: ApiPet | null;
};

export type SocialTaskListResponse = {
  message: string;
  tasks: SocialTaskHistoryItem[];
};

export type SocialMessage = {
  id: number;
  conversationId: number;
  senderPetId: number;
  content: string;
  createdAt: string;
};

export type SocialConversation = {
  conversationId: number;
  withPet: ApiPet;
  messages: SocialMessage[];
};

export type SocialMessageListResponse = {
  message: string;
  conversation: SocialConversation;
};

export type SocialSendResponse = {
  message: string;
  task: SocialTask;
  sentMessage: SocialMessage;
  replyMessage: SocialMessage;
  conversationId: number;
  targetPet: ApiPet;
};

const isApiPet = (value: unknown): value is ApiPet => {
  if (!isPetProfile(value)) {
    return false;
  }

  const pet = value as Record<string, unknown>;
  return (
    typeof pet.id === "number" &&
    typeof pet.createdAt === "string" &&
    typeof pet.updatedAt === "string"
  );
};

const isSocialCandidate = (value: unknown): value is SocialCandidate => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isApiPet(candidate.pet) &&
    (typeof candidate.friendshipStatus === "string" ||
      candidate.friendshipStatus === null) &&
    typeof candidate.direction === "string" &&
    (typeof candidate.conversationId === "number" ||
      candidate.conversationId === null) &&
    typeof candidate.canRequest === "boolean" &&
    typeof candidate.canChat === "boolean"
  );
};

const isFriendship = (value: unknown): value is Friendship => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const friendship = value as Record<string, unknown>;
  return (
    isApiPet(friendship.friend) &&
    typeof friendship.status === "string" &&
    typeof friendship.initiatedBy === "number" &&
    typeof friendship.direction === "string" &&
    (typeof friendship.conversationId === "number" ||
      friendship.conversationId === null) &&
    (typeof friendship.lastMessagePreview === "string" ||
      friendship.lastMessagePreview === null) &&
    typeof friendship.createdAt === "string" &&
    (typeof friendship.acceptedAt === "string" ||
      friendship.acceptedAt === null)
  );
};

const isSocialTask = (value: unknown): value is SocialTask => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "number" &&
    typeof task.targetPetId === "number" &&
    (typeof task.sourcePetId === "number" || task.sourcePetId === null) &&
    typeof task.taskType === "string" &&
    typeof task.state === "string" &&
    typeof task.inputText === "string" &&
    (typeof task.outputText === "string" || task.outputText === null) &&
    typeof task.createdAt === "string" &&
    (typeof task.completedAt === "string" || task.completedAt === null)
  );
};

const isSocialTaskHistoryItem = (
  value: unknown
): value is SocialTaskHistoryItem => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    isSocialTask(item.task) &&
    (isApiPet(item.counterpartPet) || item.counterpartPet === null)
  );
};

const isSocialMessage = (value: unknown): value is SocialMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "number" &&
    typeof message.conversationId === "number" &&
    typeof message.senderPetId === "number" &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string"
  );
};

const isSocialConversation = (value: unknown): value is SocialConversation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const conversation = value as Record<string, unknown>;
  return (
    typeof conversation.conversationId === "number" &&
    isApiPet(conversation.withPet) &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(isSocialMessage)
  );
};

export const isSocialCandidateListResponse = (
  value: unknown
): value is SocialCandidateListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    Array.isArray(response.candidates) &&
    response.candidates.every(isSocialCandidate)
  );
};

export const isFriendshipListResponse = (
  value: unknown
): value is FriendshipListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    Array.isArray(response.friends) &&
    response.friends.every(isFriendship)
  );
};

export const isFriendshipActionResponse = (
  value: unknown
): value is FriendshipActionResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" && isFriendship(response.friendship)
  );
};

export const isSocialTaskListResponse = (
  value: unknown
): value is SocialTaskListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    Array.isArray(response.tasks) &&
    response.tasks.every(isSocialTaskHistoryItem)
  );
};

export const isSocialMessageListResponse = (
  value: unknown
): value is SocialMessageListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    isSocialConversation(response.conversation)
  );
};

export const isSocialSendResponse = (
  value: unknown
): value is SocialSendResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    isSocialTask(response.task) &&
    isSocialMessage(response.sentMessage) &&
    isSocialMessage(response.replyMessage) &&
    typeof response.conversationId === "number" &&
    isApiPet(response.targetPet)
  );
};
