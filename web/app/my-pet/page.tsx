"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthSessionNotice } from "../../lib/AuthSessionNotice";
import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import { type ChatMessage, isMessageListResponse } from "../../lib/chat";
import {
  API_BASE_URL,
  LOGIN_REQUIRED_MESSAGE,
  MISSING_PET_MESSAGE,
  RESTORE_PET_FAILURE_MESSAGE,
} from "../../lib/constants";
import {
  EMPTY_PET,
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  mapApiPetToProfile,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
  type ApiPet,
  writeStoredPetId,
  type PetProfile,
} from "../../lib/pet";
import {
  getAppearanceSummary,
  getColorDisplay,
  getSizeDisplay,
  getSocialStatus,
  getSpeciesVisual,
  getTemperamentTag,
  summarizeText,
} from "../../lib/pet-display";
import { PetSwitcher } from "../../lib/PetSwitcher";
import {
  PetStatusPanel,
  type PetStatus,
  isPetStatus,
} from "../../lib/PetStatusPanel";
import { type PetStatusViewState } from "../../lib/pet-status-view";

export default function MyPetPage() {
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [petStatus, setPetStatus] = useState<PetStatus | null>(null);
  const [petStatusViewState, setPetStatusViewState] =
    useState<PetStatusViewState>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);
  const [recentChatStatus, setRecentChatStatus] = useState<string | null>(null);

  const applyPetStatusSnapshot = (nextStatus: PetStatus) => {
    setPetStatus(nextStatus);
    setPetStatusViewState("ready");
  };

  useEffect(() => {
    let isMounted = true;

    const loadPet = async () => {
      try {
        const storedAuthToken = readStoredAuthToken();

        if (!storedAuthToken) {
          if (isMounted) {
            setAuthToken(null);
            setPet(null);
            setMessages([]);
            setStatusMessage({
              type: "info",
              message: LOGIN_REQUIRED_MESSAGE,
            });
            setRecentChatStatus(null);
          }
          return;
        }

        if (isMounted) {
          setAuthToken(storedAuthToken);
        }

        const restoreLatestPet = async () => {
          const result = await recoverLatestPetForCurrentUser(
            storedAuthToken,
            RESTORE_PET_FAILURE_MESSAGE
          );

          if (result.unauthorized) {
            clearStoredAuth();

            if (isMounted) {
              setAuthToken(null);
              setPet(null);
              setMessages([]);
              setStatusMessage({
                type: "info",
                message: LOGIN_REQUIRED_MESSAGE,
              });
              setRecentChatStatus(null);
            }

            return { pet: null as ApiPet | null, blocked: true };
          }

          if (result.errorMessage) {
            if (isMounted) {
              setPet(null);
              setMessages([]);
              setStatusMessage({
                type: "error",
                message: result.errorMessage,
              });
              setRecentChatStatus(null);
            }

            return { pet: null as ApiPet | null, blocked: true };
          }

          if (!result.pet) {
            return { pet: null as ApiPet | null, blocked: false };
          }

          writeStoredPetId(result.pet.id);
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
              setPet(null);
              setMessages([]);
              setStatusMessage(null);
              setRecentChatStatus(null);
            }
            return;
          }

          activePetId = restoreResult.pet.id;
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
            setPet(null);
            setMessages([]);
            setStatusMessage({
              type: "info",
              message: LOGIN_REQUIRED_MESSAGE,
            });
            setRecentChatStatus(null);
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

            if (
              restoredPetResponse.ok &&
              restoredMessagesResponse.ok
            ) {
              const restoredPetData: unknown = await restoredPetResponse.json();
              const restoredMessagesData: unknown =
                await restoredMessagesResponse.json();

              if (
                isPetApiResponse(restoredPetData) &&
                isMessageListResponse(restoredMessagesData)
              ) {
                if (isMounted) {
                  setPet(mapApiPetToProfile(restoredPetData.pet));
                  setMessages(restoredMessagesData.messages);
                  setStatusMessage(null);
                  setRecentChatStatus(null);
                }

                return;
              }
            }
          }

          if (isMounted) {
            setPet(null);
            setMessages([]);
            setStatusMessage({
              type: "error",
              message: MISSING_PET_MESSAGE,
            });
            setRecentChatStatus(null);
          }

          return;
        }

        if (!petResponse.ok) {
          const errorMessage = await getResponseErrorMessage(
            petResponse,
            "加载宠物资料失败，请稍后再试。"
          );

          if (isMounted) {
            setPet(null);
            setMessages([]);
            setStatusMessage({
              type: "error",
              message: errorMessage,
            });
            setRecentChatStatus(null);
          }

          return;
        }

        const petData: unknown = await petResponse.json();

        if (!isPetApiResponse(petData)) {
          if (isMounted) {
            setPet(null);
            setMessages([]);
            setStatusMessage({
              type: "error",
              message: "后端返回的数据格式不太对，请稍后再试。",
            });
            setRecentChatStatus(null);
          }

          return;
        }

        if (!messagesResponse.ok) {
          const errorMessage = await getResponseErrorMessage(
            messagesResponse,
            "最近聊天暂时加载失败，请稍后再试。"
          );

          if (isMounted) {
            setPet(mapApiPetToProfile(petData.pet));
            setMessages([]);
            setStatusMessage(null);
            setRecentChatStatus(errorMessage);
          }

          return;
        }

        const messagesData: unknown = await messagesResponse.json();

        if (!isMessageListResponse(messagesData)) {
          if (isMounted) {
            setPet(mapApiPetToProfile(petData.pet));
            setMessages([]);
            setStatusMessage(null);
            setRecentChatStatus("最近聊天数据格式不太对，请稍后再试。");
          }

          return;
        }

        if (isMounted) {
          setPet(mapApiPetToProfile(petData.pet));
          setPetId(petData.pet.id);
          setMessages(messagesData.messages);
          setStatusMessage(null);
          setRecentChatStatus(null);
        }
      } catch {
        if (isMounted) {
          setPet(null);
          setMessages([]);
          setStatusMessage({
            type: "error",
            message: "暂时连不上后端，请确认服务已启动。",
          });
          setRecentChatStatus(null);
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    void loadPet();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!pet || !petId || !authToken) {
      setPetStatus(null);
      setPetStatusViewState("loading");
      return () => {
        isMounted = false;
      };
    }

    const loadPetStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pets/${petId}/status`, {
          cache: "no-store",
          headers: buildAuthHeaders(authToken),
        });

        if (response.status === 401) {
          clearStoredAuth();
          clearStoredPetId();

          if (isMounted) {
            setAuthToken(null);
            setPet(null);
            setPetId(null);
            setPetStatus(null);
            setPetStatusViewState("loading");
            setMessages([]);
            setStatusMessage({
              type: "info",
              message: LOGIN_REQUIRED_MESSAGE,
            });
            setRecentChatStatus(null);
          }
          return;
        }

        if (!response.ok) {
          if (isMounted) {
            setPetStatus(null);
            setPetStatusViewState("unavailable");
          }
          return;
        }

        const data: unknown = await response.json();
        if (isMounted) {
          if (isPetStatus(data)) {
            applyPetStatusSnapshot(data);
          } else {
            setPetStatus(null);
            setPetStatusViewState("unavailable");
          }
        }
      } catch {
        if (isMounted) {
          setPetStatus(null);
          setPetStatusViewState("unavailable");
        }
      }
    };

    void loadPetStatus();

    return () => {
      isMounted = false;
    };
  }, [authToken, pet, petId]);

  const handlePetSwitch = (_newPetId: number) => {
    void _newPetId;
    window.location.reload();
  };

  const petCardName = pet?.petName || "未命名宠物";
  const petCardSpecies = pet?.species || "待选择品种";
  const petCardColor = pet?.color || "待补充颜色";
  const petCardSize = pet?.size || "待选择体型";
  const petCardPersonality =
    pet?.personality ||
    "这里会显示宠物的性格摘要，比如温柔、活泼、黏人，或者有一点自己的小脾气。";
  const petCardSpecialTraits =
    pet?.specialTraits ||
    "这里会显示宠物的特殊特征，比如毛色细节、耳朵形状、尾巴特点，或者很容易被记住的小标记。";
  const petSpeciesVisual = getSpeciesVisual(pet?.species || "");
  const petColorDisplay = getColorDisplay(pet?.color || "");
  const petSizeDisplay = getSizeDisplay(pet?.size || "");
  const petTemperamentTag = getTemperamentTag(pet?.personality || "");
  const petAppearanceSummary = getAppearanceSummary(
    pet || EMPTY_PET
  );
  const petSocialStatus = getSocialStatus(pet || EMPTY_PET);
  const emptyStateTitle = statusMessage
    ? "暂时还看不到宠物资料"
    : "你还没有创建宠物";
  const emptyStateMessage =
    statusMessage?.message ||
    "先去创建你的第一只宠物吧。填写完成后保存，资料就会出现在这里。";
  const recentMessages = [...messages].slice(-3).reverse();
  const pageEmptyStateTitle = !authToken
    ? "请先登录后再查看宠物"
    : emptyStateTitle;
  const pageEmptyStateMessage = !authToken
    ? LOGIN_REQUIRED_MESSAGE
    : emptyStateMessage;

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">
            ← 返回首页
          </Link>
          <Link href="/create-pet" className="transition hover:text-gray-800">
            去创建宠物
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">我的宠物</h1>
              <p className="mt-3 text-base leading-7 text-gray-600">
                这里会展示你已经保存下来的宠物资料。
              </p>
            </div>
            {authToken && petId && (
              <PetSwitcher
                currentPetId={petId}
                authToken={authToken}
                onPetSwitch={handlePetSwitch}
              />
            )}
          </div>
        </div>

        <AuthSessionNotice authToken={authToken} className="mb-8" />

        {!isLoaded ? (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <p className="text-sm leading-6 text-gray-600">
              正在读取宠物资料，请稍等一下。
            </p>
          </section>
        ) : null}

        {isLoaded && !pet ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">
              {pageEmptyStateTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {pageEmptyStateMessage}
            </p>

            <div className="mt-6">
              <Link
                href={authToken ? "/create-pet" : "/login"}
                className="relative inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-transparent transition hover:bg-gray-700"
              >
                <span className="absolute inset-0 flex items-center justify-center text-white">
                  {authToken ? "去创建宠物" : "去登录"}
                </span>
                去创建宠物
              </Link>
            </div>
          </section>
        ) : null}

        {isLoaded && pet ? (
          <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  已保存的宠物资料
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  这是你当前从后端读取到的宠物资料卡片。
                </p>
              </div>

              <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm">
                后端已同步
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-[0_20px_60px_-24px_rgba(180,83,9,0.35)]">
              <div className="bg-gradient-to-br from-orange-100 via-amber-50 to-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm ring-8 ring-white/70">
                      <span aria-hidden="true">{petSpeciesVisual.icon}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs text-gray-500 shadow-sm">
                      <span
                        className={`h-3 w-3 rounded-full ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      {petColorDisplay.helper}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-700">
                      宠物资料卡片
                    </p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                      {petCardName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      这些内容来自后端里当前保存的宠物资料。
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {petSpeciesVisual.label}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${petSizeDisplay.className}`}
                      >
                        {petSizeDisplay.label}
                      </span>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {petColorDisplay.label}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-amber-700">
                      {petSpeciesVisual.note}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">品种外貌</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {petSpeciesVisual.icon} {petCardSpecies}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">主颜色</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`h-10 w-10 rounded-2xl ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {petCardColor}
                        </p>
                        <p className="text-xs text-gray-500">
                          {petColorDisplay.helper}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">体型</p>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petSizeDisplay.className}`}
                      >
                        {petCardSize}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-900">外貌摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petAppearanceSummary}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">气质标签</p>
                    <div className="mt-3 flex items-start gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petTemperamentTag.className}`}
                      >
                        {petTemperamentTag.label}
                      </span>
                      <p className="min-w-0 text-sm leading-6 text-gray-600">
                        {petTemperamentTag.note}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">社交状态</p>
                    <div className="mt-3 flex items-start gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petSocialStatus.className}`}
                      >
                        {petSocialStatus.label}
                      </span>
                      <p className="min-w-0 text-sm leading-6 text-gray-600">
                        {petSocialStatus.note}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 p-4 text-sm leading-6 text-gray-600">
                  现在这张资料卡已经能用品种图标、颜色展示和体型标签，先把宠物的外貌感做出来，后续如果接图片也能自然延展。
                </div>
              </div>

              <div className="space-y-4 p-6">
                {petId && authToken && (
                  <PetStatusPanel
                    petId={petId}
                    authToken={authToken}
                    status={petStatus}
                    statusViewState={petStatusViewState}
                    onStatusChange={applyPetStatusSnapshot}
                  />
                )}

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">性格摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardPersonality}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">
                    特殊特征摘要
                  </p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardSpecialTraits}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        最近聊天
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        这里只展示最近 3 条消息，帮你快速看看你们最近聊了什么。
                      </p>
                    </div>

                    <Link
                      href="/chat"
                      className="text-sm font-medium text-amber-700 transition hover:text-amber-800"
                    >
                      去聊天 →
                    </Link>
                  </div>

                  {recentMessages.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {recentMessages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-2xl bg-white px-4 py-3 shadow-sm"
                        >
                          <p className="text-xs font-medium text-gray-500">
                            {message.role === "user" ? "你" : petCardName}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-gray-700">
                            {summarizeText(message.content, 36)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : recentChatStatus ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                      {recentChatStatus}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white/80 px-4 py-6 text-sm leading-6 text-gray-500">
                      你们还没有聊过天，快去和它打个招呼吧。
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/create-pet"
                    className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
                  >
                    编辑我的宠物
                  </Link>

                  <Link
                    href="/chat"
                    className="inline-flex rounded-lg bg-amber-100 px-5 py-3 text-sm font-medium text-amber-800 transition hover:bg-amber-200"
                  >
                    去和它聊天
                  </Link>

                  <p className="text-sm text-gray-500">
                    想更新资料的话，回到创建页面继续编辑并重新保存一次就可以。
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
