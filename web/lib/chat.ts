export type ChatMessage = {
  id: number;
  pet_id: number;
  role: "user" | "pet";
  content: string;
  created_at: string;
};

export type MessageListResponse = {
  messages: ChatMessage[];
};

export type ChatResponse = {
  user_message: ChatMessage;
  pet_message: ChatMessage;
};

export type DeleteMessagesResponse = {
  message: string;
};

export const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    typeof message.id === "number" &&
    typeof message.pet_id === "number" &&
    (message.role === "user" || message.role === "pet") &&
    typeof message.content === "string" &&
    typeof message.created_at === "string"
  );
};

export const isMessageListResponse = (
  value: unknown
): value is MessageListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    Array.isArray(response.messages) && response.messages.every(isChatMessage)
  );
};

export const isChatResponse = (value: unknown): value is ChatResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    isChatMessage(response.user_message) && isChatMessage(response.pet_message)
  );
};

export const isDeleteMessagesResponse = (
  value: unknown
): value is DeleteMessagesResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string";
};
