"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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

type PetChatResponse = {
  message: string;
  petName: string;
  reply: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "pet";
  content: string;
};

const PET_ID_STORAGE_KEY = "pet-agent-social:pet-id";
const API_BASE_URL = "http://localhost:8000";
const MISSING_PET_MESSAGE = "之前保存的宠物资料找不到了，请重新创建一次。";

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

const isPetChatResponse = (value: unknown): value is PetChatResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    typeof response.petName === "string" &&
    typeof response.reply === "string"
  );
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

export default function ChatPage() {
  const [petId, setPetId] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingPet, setIsLoadingPet] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPet = async () => {
      try {
        const storedPetId = readStoredPetId();

        if (!storedPetId) {
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

        const response = await fetch(`${API_BASE_URL}/pets/${storedPetId}`, {
          cache: "no-store",
        });

        if (response.ok) {
          const data: unknown = await response.json();

          if (isMounted && isPetApiResponse(data)) {
            const currentPetName = data.pet.petName || "你的宠物";

            setPetId(data.pet.id);
            setPetName(currentPetName);
            setMessages([
              {
                id: "pet-welcome",
                role: "pet",
                content: `我是${currentPetName}，今天想和我聊点什么？`,
              },
            ]);
            setStatusMessage(null);
          } else if (isMounted) {
            setStatusMessage({
              type: "error",
              message: "后端返回的数据格式不太对，请稍后再试。",
            });
          }

          return;
        }

        if (response.status === 404) {
          clearStoredPetId();

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

        const errorMessage = await getResponseErrorMessage(
          response,
          "加载宠物资料失败，请稍后再试。"
        );

        if (isMounted) {
          setStatusMessage({
            type: "error",
            message: errorMessage,
          });
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
          setIsLoadingPet(false);
        }
      }
    };

    void loadPet();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = inputValue.trim();

    if (!trimmedMessage || !petId || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInputValue("");
    setStatusMessage(null);
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${petId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
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

        const errorMessage = await getResponseErrorMessage(
          response,
          "这次没有收到宠物回复，请稍后再试。"
        );

        setStatusMessage({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      const data: unknown = await response.json();

      if (!isPetChatResponse(data)) {
        setStatusMessage({
          type: "error",
          message: "后端返回的数据格式不太对，请稍后再试。",
        });
        return;
      }

      setPetName(data.petName || petName);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `pet-${Date.now()}`,
          role: "pet",
          content: data.reply,
        },
      ]);
    } catch {
      setStatusMessage({
        type: "error",
        message: "暂时连不上后端，请确认服务已启动。",
      });
    } finally {
      setIsSending(false);
    }
  };

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
            这一版先做最小可运行链路。你说一句话，宠物会先给你一条简单自然的假回复。
          </p>
        </div>

        {isLoadingPet ? (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <p className="text-sm leading-6 text-gray-600">
              正在读取宠物资料，请稍等一下。
            </p>
          </section>
        ) : null}

        {!isLoadingPet && !petId ? (
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

        {!isLoadingPet && petId ? (
          <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="rounded-[28px] border border-orange-100 bg-white shadow-[0_20px_60px_-24px_rgba(180,83,9,0.35)]">
              <div className="border-b border-orange-100 bg-gradient-to-r from-orange-100 via-amber-50 to-white px-6 py-5">
                <p className="text-sm font-medium text-amber-700">宠物聊天窗口</p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  正在和 {petName} 聊天
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  先从一句简单的话开始吧。现在的回复还是占位版本，但已经能走通完整前后端链路。
                </p>
              </div>

              <div className="space-y-4 p-6">
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

                <div className="min-h-[320px] space-y-3 rounded-2xl bg-gray-50 p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
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
                      placeholder="例如：今天过得怎么样？"
                      disabled={isSending}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !inputValue.trim()}
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
