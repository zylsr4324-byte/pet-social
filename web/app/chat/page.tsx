"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type PetProfile = {
  petName: string;
  species: string;
  color: string;
  size: string;
  personality: string;
  specialTraits: string;
};

type ApiPet = PetProfile & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

type PetApiResponse = {
  message: string;
  pet: ApiPet;
};

type PetListResponse = {
  message: string;
  pets: ApiPet[];
};

type ChatMessage = {
  id: number;
  pet_id: number;
  role: "user" | "pet";
  content: string;
  created_at: string;
};

type MessageListResponse = {
  messages: ChatMessage[];
};

type ChatResponse = {
  user_message: ChatMessage;
  pet_message: ChatMessage;
};

type DeleteMessagesResponse = {
  message: string;
};

const PET_ID_STORAGE_KEY = "pet-agent-social:pet-id";
const AUTH_TOKEN_STORAGE_KEY = "pet-agent-social:auth-token";
const AUTH_USER_EMAIL_STORAGE_KEY = "pet-agent-social:auth-user-email";
const API_BASE_URL = "http://localhost:8000";
const RESTORE_PET_FAILURE_MESSAGE = "读取宠物列表失败了，请稍后再试。";
const MISSING_PET_MESSAGE = "之前保存的宠物资料找不到了，请重新创建一次。";
const SEND_FAILURE_MESSAGE = "发送失败了，请稍后再试。";
const CLEAR_MESSAGES_FAILURE_MESSAGE = "清空聊天记录失败了，请稍后再试。";
const SEND_TIMEOUT_MS = 8000;
const LOGIN_REQUIRED_MESSAGE = "请先登录后再使用这个页面。";

const isPetProfile = (value: unknown): value is PetProfile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pet = value as Record<string, unknown>;

  return (
    typeof pet.petName === "string" &&
    typeof pet.species === "string" &&
    typeof pet.color === "string" &&
    typeof pet.size === "string" &&
    typeof pet.personality === "string" &&
    typeof pet.specialTraits === "string"
  );
};

const isPetApiResponse = (value: unknown): value is PetApiResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    isPetProfile(response.pet) &&
    typeof (response.pet as { id?: unknown }).id === "number"
  );
};

const isPetListResponse = (value: unknown): value is PetListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    Array.isArray(response.pets) &&
    response.pets.every(isPetProfile) &&
    response.pets.every((pet) => typeof (pet as { id?: unknown }).id === "number")
  );
};

const isChatMessage = (value: unknown): value is ChatMessage => {
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

const isMessageListResponse = (value: unknown): value is MessageListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return Array.isArray(response.messages) && response.messages.every(isChatMessage);
};

const isChatResponse = (value: unknown): value is ChatResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    isChatMessage(response.user_message) && isChatMessage(response.pet_message)
  );
};

const isDeleteMessagesResponse = (
  value: unknown
): value is DeleteMessagesResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string";
};

const clearStoredPetId = () => {
  window.localStorage.removeItem(PET_ID_STORAGE_KEY);
};

const readStoredPetId = () => {
  const storedPetId = window.localStorage.getItem(PET_ID_STORAGE_KEY);

  if (!storedPetId) {
    return null;
  }

  const parsedPetId = Number(storedPetId);

  if (Number.isInteger(parsedPetId) && parsedPetId > 0) {
    return parsedPetId;
  }

  clearStoredPetId();
  return null;
};

const readStoredAuthToken = () => {
  const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  return storedToken?.trim() ? storedToken : null;
};

const clearStoredAuth = () => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_EMAIL_STORAGE_KEY);
};

const buildAuthHeaders = (token: string, includeJson = false) => {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const getResponseErrorMessage = async (
  response: Response,
  fallbackMessage: string
) => {
  try {
    const data = await response.json();

    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
};

const fetchLatestPetForCurrentUser = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/pets`, {
    cache: "no-store",
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    return {
      pet: null as ApiPet | null,
      unauthorized: true,
      errorMessage: null as string | null,
    };
  }

  if (!response.ok) {
    return {
      pet: null as ApiPet | null,
      unauthorized: false,
      errorMessage: await getResponseErrorMessage(
        response,
        RESTORE_PET_FAILURE_MESSAGE
      ),
    };
  }

  const data: unknown = await response.json();

  if (!isPetListResponse(data)) {
    return {
      pet: null as ApiPet | null,
      unauthorized: false,
      errorMessage: RESTORE_PET_FAILURE_MESSAGE,
    };
  }

  return {
    pet: data.pets[0] ?? null,
    unauthorized: false,
    errorMessage: null as string | null,
  };
};

export default function ChatPage() {
  const [petId, setPetId] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearingMessages, setIsClearingMessages] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);
  const canSendMessage = Boolean(
    inputValue.trim() && petId && authToken && !isSending && !isClearingMessages
  );
  const canClearMessages = Boolean(
    petId && authToken && !isLoadingChat && !isSending && !isClearingMessages
  );
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadChat = async () => {
      try {
        const storedAuthToken = readStoredAuthToken();

        if (!storedAuthToken) {
          if (isMounted) {
            setAuthToken(null);
            setPetId(null);
            setPetName("");
            setMessages([]);
            setStatusMessage({
              type: "info",
              message: LOGIN_REQUIRED_MESSAGE,
            });
          }
          return;
        }

        if (isMounted) {
          setAuthToken(storedAuthToken);
        }

        const restoreLatestPet = async () => {
          const result = await fetchLatestPetForCurrentUser(storedAuthToken);

          if (result.unauthorized) {
            clearStoredAuth();

            if (isMounted) {
              setAuthToken(null);
              setPetId(null);
              setPetName("");
              setMessages([]);
              setStatusMessage({
                type: "info",
                message: LOGIN_REQUIRED_MESSAGE,
              });
            }

            return { pet: null as ApiPet | null, blocked: true };
          }

          if (result.errorMessage) {
            if (isMounted) {
              setPetId(null);
              setPetName("");
              setMessages([]);
              setStatusMessage({
                type: "error",
                message: result.errorMessage,
              });
            }

            return { pet: null as ApiPet | null, blocked: true };
          }

          if (!result.pet) {
            return { pet: null as ApiPet | null, blocked: false };
          }

          window.localStorage.setItem(PET_ID_STORAGE_KEY, String(result.pet.id));
          return { pet: result.pet, blocked: false };
        };

        let activePetId = readStoredPetId();

        if (!activePetId) {
          const restoreResult = await restoreLatestPet();

          if (restoreResult.blocked) {
            return;
          }

          if (!restoreResult.pet) {
            if (isMounted) {
              setPetId(null);
              setPetName("");
              setMessages([]);
              setStatusMessage({
                type: "info",
                message: "你还没有宠物，先去创建一只再来聊天吧。",
              });
            }
            return;
          }

          activePetId = restoreResult.pet.id;
        }

        if (!activePetId) {
          if (isMounted) {
            setPetId(null);
            setPetName("");
            setMessages([]);
            setStatusMessage({
              type: "info",
              message: "你还没有创建宠物，先去创建后再来聊天吧。",
            });
          }
          return;
        }

        const [petResponse, messagesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/pets/${activePetId}`, {
            cache: "no-store",
            headers: buildAuthHeaders(storedAuthToken),
          }),
          fetch(`${API_BASE_URL}/pets/${activePetId}/messages`, {
            cache: "no-store",
            headers: buildAuthHeaders(storedAuthToken),
          }),
        ]);

        if (petResponse.status === 401 || messagesResponse.status === 401) {
          clearStoredAuth();

          if (isMounted) {
            setAuthToken(null);
            setPetId(null);
            setPetName("");
            setMessages([]);
            setStatusMessage({
              type: "info",
              message: LOGIN_REQUIRED_MESSAGE,
            });
          }

          return;
        }

        if (petResponse.status === 404 || messagesResponse.status === 404) {
          clearStoredPetId();

          const restoreResult = await restoreLatestPet();

          if (restoreResult.blocked) {
            return;
          }

          if (restoreResult.pet) {
            activePetId = restoreResult.pet.id;

            const [restoredPetResponse, restoredMessagesResponse] = await Promise.all([
              fetch(`${API_BASE_URL}/pets/${activePetId}`, {
                cache: "no-store",
                headers: buildAuthHeaders(storedAuthToken),
              }),
              fetch(`${API_BASE_URL}/pets/${activePetId}/messages`, {
                cache: "no-store",
                headers: buildAuthHeaders(storedAuthToken),
              }),
            ]);

            if (restoredPetResponse.ok && restoredMessagesResponse.ok) {
              const restoredPetData: unknown = await restoredPetResponse.json();
              const restoredMessagesData: unknown =
                await restoredMessagesResponse.json();

              if (
                isPetApiResponse(restoredPetData) &&
                isMessageListResponse(restoredMessagesData)
              ) {
                if (isMounted) {
                  setPetId(restoredPetData.pet.id);
                  setPetName(restoredPetData.pet.petName || "宠物");
                  setMessages(restoredMessagesData.messages);
                  setStatusMessage(null);
                }

                return;
              }
            }
          }

          if (isMounted) {
            setPetId(null);
            setPetName("");
            setMessages([]);
            setStatusMessage({
              type: "error",
              message: MISSING_PET_MESSAGE,
            });
          }

          return;
        }

        if (!petResponse.ok) {
          const errorMessage = await getResponseErrorMessage(
            petResponse,
            "加载宠物资料失败，请稍后再试。"
          );

          if (isMounted) {
            setStatusMessage({
              type: "error",
              message: errorMessage,
            });
          }

          return;
        }

        if (!messagesResponse.ok) {
          const errorMessage = await getResponseErrorMessage(
            messagesResponse,
            "加载聊天记录失败，请稍后再试。"
          );

          if (isMounted) {
            setStatusMessage({
              type: "error",
              message: errorMessage,
            });
          }

          return;
        }

        const petData: unknown = await petResponse.json();
        const messagesData: unknown = await messagesResponse.json();

        if (!isPetApiResponse(petData) || !isMessageListResponse(messagesData)) {
          if (isMounted) {
            setStatusMessage({
              type: "error",
              message: "后端返回的数据格式不太对，请稍后再试。",
            });
          }

          return;
        }

        if (isMounted) {
          setPetId(petData.pet.id);
          setPetName(petData.pet.petName || "你的宠物");
          setMessages(messagesData.messages);
          setStatusMessage(null);
        }
      } catch {
        if (isMounted) {
          setStatusMessage({
            type: "error",
            message: "暂时连不上后端，请确认服务已启动。",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingChat(false);
        }
      }
    };

    void loadChat();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingChat || !petId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const messagesContainer = messagesContainerRef.current;

      if (!messagesContainer) {
        return;
      }

      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: "auto",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [messages, isLoadingChat, petId]);

  const sendMessage = async () => {
    const trimmedMessage = inputValue.trim();

    if (!trimmedMessage || !petId || !authToken || isSending || isClearingMessages) {
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, SEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${petId}/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: buildAuthHeaders(authToken, true),
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      if (response.status === 401) {
        clearStoredAuth();
        setAuthToken(null);
        setPetId(null);
        setPetName("");
        setMessages([]);
        setStatusMessage({
          type: "info",
          message: LOGIN_REQUIRED_MESSAGE,
        });
        return;
      }

      if (response.status === 404) {
        clearStoredPetId();
        setPetId(null);
        setPetName("");
        setMessages([]);
        setStatusMessage({
          type: "error",
          message: MISSING_PET_MESSAGE,
        });
        return;
      }

      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(
          response,
          SEND_FAILURE_MESSAGE
        );

        setStatusMessage({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      const data: unknown = await response.json();

      if (!isChatResponse(data)) {
        setStatusMessage({
          type: "error",
          message: "后端返回的数据格式不太对，请稍后再试。",
        });
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        data.user_message,
        data.pet_message,
      ]);
      setInputValue("");
    } catch {
      setStatusMessage({
        type: "error",
        message: SEND_FAILURE_MESSAGE,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsSending(false);
    }
  };

  const handleClearMessages = async () => {
    if (!petId || !authToken || isSending || isClearingMessages) {
      return;
    }

    const confirmed = window.confirm("确认要清空当前宠物的全部聊天记录吗？");

    if (!confirmed) {
      return;
    }

    setIsClearingMessages(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${petId}/messages`, {
        method: "DELETE",
        headers: buildAuthHeaders(authToken),
      });

      if (response.status === 401) {
        clearStoredAuth();
        setAuthToken(null);
        setPetId(null);
        setPetName("");
        setMessages([]);
        setInputValue("");
        setStatusMessage({
          type: "info",
          message: LOGIN_REQUIRED_MESSAGE,
        });
        return;
      }

      if (response.status === 404) {
        clearStoredPetId();
        setPetId(null);
        setPetName("");
        setMessages([]);
        setInputValue("");
        setStatusMessage({
          type: "error",
          message: MISSING_PET_MESSAGE,
        });
        return;
      }

      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(
          response,
          CLEAR_MESSAGES_FAILURE_MESSAGE
        );

        setStatusMessage({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      let successMessage = "聊天记录已清空，现在可以重新开始聊天了。";

      try {
        const data: unknown = await response.json();

        if (isDeleteMessagesResponse(data)) {
          successMessage = data.message;
        }
      } catch {
        successMessage = "聊天记录已清空，现在可以重新开始聊天了。";
      }

      setMessages([]);
      setInputValue("");
      setStatusMessage({
        type: "info",
        message: successMessage,
      });
    } catch {
      setStatusMessage({
        type: "error",
        message: CLEAR_MESSAGES_FAILURE_MESSAGE,
      });
    } finally {
      setIsClearingMessages(false);
    }
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!canSendMessage) {
      return;
    }

    void sendMessage();
  };

  const emptyChatTitle = authToken
    ? "还不能开始聊天"
    : "请先登录后再聊天";
  const emptyChatMessage = authToken
    ? statusMessage?.message ||
      "你还没有创建宠物，先去创建后再回来和它聊天吧。"
    : LOGIN_REQUIRED_MESSAGE;

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">
            ← 返回首页
          </Link>
          <Link href="/my-pet" className="transition hover:text-gray-800">
            去我的宠物
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">和宠物聊天</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            这次聊天记录会保存到后端。刷新页面后，你和宠物刚刚说过的话还会在这里。
          </p>
        </div>

        {isLoadingChat ? (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <p className="text-sm leading-6 text-gray-600">
              正在读取宠物资料和聊天记录，请稍等一下。
            </p>
          </section>
        ) : null}

        {!isLoadingChat && !authToken ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">
              {emptyChatTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {emptyChatMessage}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                去登录
              </Link>
              <Link
                href="/register"
                className="text-sm text-gray-500 transition hover:text-gray-800"
              >
                还没有账号？去注册
              </Link>
            </div>
          </section>
        ) : null}

        {!isLoadingChat && authToken && !petId ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">
              现在还不能开始聊天
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {statusMessage?.message ||
                "你还没有创建宠物，先去创建后再来聊天吧。"}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/create-pet"
                className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                去创建宠物
              </Link>
              <Link
                href="/my-pet"
                className="text-sm text-gray-500 transition hover:text-gray-800"
              >
                先看看我的宠物 →
              </Link>
            </div>
          </section>
        ) : null}

        {!isLoadingChat && petId ? (
          <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="rounded-[28px] border border-orange-100 bg-white shadow-[0_20px_60px_-24px_rgba(180,83,9,0.35)]">
              <div className="border-b border-orange-100 bg-gradient-to-r from-orange-100 via-amber-50 to-white px-6 py-5">
                <p className="text-sm font-medium text-amber-700">宠物聊天窗口</p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  正在和 {petName} 聊天
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  现在的回复还是最小版本，但聊天记录已经会保存在后端了。
                </p>
              </div>

              <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3">
                  <p className="text-sm leading-6 text-gray-600">
                    想重新整理上下文时，可以直接清空这只宠物的聊天记录。
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleClearMessages()}
                    disabled={!canClearMessages}
                    className="text-sm font-medium text-amber-700 transition hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isClearingMessages ? "清空中..." : "清空聊天记录"}
                  </button>
                </div>

                {statusMessage ? (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
                      statusMessage.type === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {statusMessage.message}
                  </div>
                ) : null}

                <div
                  ref={messagesContainerRef}
                  className="h-[360px] overflow-y-auto rounded-2xl bg-gray-50 p-4 sm:h-[420px]"
                >
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 text-center text-sm leading-6 text-gray-500">
                      还没有聊天记录，先和 {petName} 打个招呼吧。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                              message.role === "user"
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-700"
                            }`}
                          >
                            <p className="mb-1 text-xs font-medium opacity-70">
                              {message.role === "user" ? "你" : petName}
                            </p>
                            <p>{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <label
                    htmlFor="chat-message"
                    className="mb-2 block text-sm font-medium text-gray-800"
                  >
                    对 {petName} 说点什么
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      id="chat-message"
                      type="text"
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="例如：今天过得怎么样？"
                      disabled={isSending || isClearingMessages}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={!canSendMessage}
                      className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSending ? "发送中..." : "发送"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
