"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import { API_BASE_URL, LOGIN_REQUIRED_MESSAGE } from "../../lib/constants";
import {
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
} from "../../lib/pet";
import { PetSwitcher } from "../../lib/PetSwitcher";
import {
  type Friendship,
  type SocialCandidate,
  type SocialConversation,
  type SocialTaskHistoryItem,
  isFriendshipActionResponse,
  isFriendshipListResponse,
  isSocialCandidateListResponse,
  isSocialMessageListResponse,
  isSocialSendResponse,
  isSocialTaskListResponse,
} from "../../lib/social";

const LOAD_FAILURE_MESSAGE = "加载站内社交数据失败，请稍后再试。";
const ACTION_FAILURE_MESSAGE = "操作失败，请稍后再试。";

export default function SocialPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const [candidates, setCandidates] = useState<SocialCandidate[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [tasks, setTasks] = useState<SocialTaskHistoryItem[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<SocialConversation | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  const selectedCandidate =
    candidates.find((candidate) => candidate.pet.id === selectedTargetId) ?? null;

  const handleUnauthorized = () => {
    clearStoredAuth();
    clearStoredPetId();
    setAuthToken(null);
    setPetId(null);
    setPetName("");
    setCandidates([]);
    setFriendships([]);
    setTasks([]);
    setSelectedTargetId(null);
    setConversation(null);
    setStatusMessage(LOGIN_REQUIRED_MESSAGE);
  };

  const readConversation = async (
    activePetId: number,
    token: string,
    targetPetId: number
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/pets/${activePetId}/social/messages/${targetPetId}`,
      { cache: "no-store", headers: buildAuthHeaders(token) }
    );

    if (response.status === 401) {
      handleUnauthorized();
      return null;
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, LOAD_FAILURE_MESSAGE));
    }

    const data: unknown = await response.json();
    if (!isSocialMessageListResponse(data)) {
      throw new Error(LOAD_FAILURE_MESSAGE);
    }
    return data.conversation;
  };

  const loadDashboard = async (
    activePetId: number,
    token: string,
    preferredTargetId?: number | null
  ) => {
    const [petResponse, candidatesResponse, friendsResponse, tasksResponse] =
      await Promise.all([
        fetch(`${API_BASE_URL}/pets/${activePetId}`, {
          cache: "no-store",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API_BASE_URL}/pets/${activePetId}/social/candidates`, {
          cache: "no-store",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API_BASE_URL}/pets/${activePetId}/friends`, {
          cache: "no-store",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API_BASE_URL}/pets/${activePetId}/social/tasks`, {
          cache: "no-store",
          headers: buildAuthHeaders(token),
        }),
      ]);

    if (
      petResponse.status === 401 ||
      candidatesResponse.status === 401 ||
      friendsResponse.status === 401 ||
      tasksResponse.status === 401
    ) {
      handleUnauthorized();
      return;
    }

    if (
      !petResponse.ok ||
      !candidatesResponse.ok ||
      !friendsResponse.ok ||
      !tasksResponse.ok
    ) {
      const failedResponse =
        !petResponse.ok
          ? petResponse
          : !candidatesResponse.ok
            ? candidatesResponse
            : !friendsResponse.ok
              ? friendsResponse
              : tasksResponse;
      throw new Error(
        await getResponseErrorMessage(failedResponse, LOAD_FAILURE_MESSAGE)
      );
    }

    const petData: unknown = await petResponse.json();
    const candidatesData: unknown = await candidatesResponse.json();
    const friendsData: unknown = await friendsResponse.json();
    const tasksData: unknown = await tasksResponse.json();

    if (
      !isPetApiResponse(petData) ||
      !isSocialCandidateListResponse(candidatesData) ||
      !isFriendshipListResponse(friendsData) ||
      !isSocialTaskListResponse(tasksData)
    ) {
      throw new Error("后端返回的社交数据格式不正确。");
    }

    setPetId(petData.pet.id);
    setPetName(petData.pet.petName);
    setCandidates(candidatesData.candidates);
    setFriendships(friendsData.friends);
    setTasks(tasksData.tasks);

    const nextTargetId =
      preferredTargetId &&
      candidatesData.candidates.some((item) => item.pet.id === preferredTargetId)
        ? preferredTargetId
        : candidatesData.candidates.find((item) => item.canChat)?.pet.id ??
          candidatesData.candidates[0]?.pet.id ??
          null;

    setSelectedTargetId(nextTargetId);
    setConversation(
      nextTargetId ? await readConversation(activePetId, token, nextTargetId) : null
    );
  };

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const storedToken = readStoredAuthToken();
        if (!storedToken) {
          setStatusMessage(LOGIN_REQUIRED_MESSAGE);
          return;
        }

        setAuthToken(storedToken);
        let activePetId = readStoredPetId();

        if (!activePetId) {
          const restoreResult = await recoverLatestPetForCurrentUser(
            storedToken,
            LOAD_FAILURE_MESSAGE
          );
          if (restoreResult.unauthorized) {
            handleUnauthorized();
            return;
          }
          activePetId = restoreResult.pet?.id ?? null;
        }

        if (!activePetId) {
          setStatusMessage("你还没有宠物，先去创建一只再开始社交吧。");
          return;
        }

        await loadDashboard(activePetId, storedToken, null);
      } catch (error) {
        if (isMounted) {
          setStatusMessage(
            error instanceof Error ? error.message : LOAD_FAILURE_MESSAGE
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async (runner: () => Promise<void>) => {
    if (isActing) {
      return;
    }

    setIsActing(true);
    setStatusMessage(null);

    try {
      await runner();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : ACTION_FAILURE_MESSAGE
      );
    } finally {
      setIsActing(false);
    }
  };

  const refresh = async (preferredTargetId?: number | null) => {
    if (!petId || !authToken) {
      return;
    }
    await loadDashboard(petId, authToken, preferredTargetId ?? selectedTargetId);
  };

  const postAndRefresh = async (
    url: string,
    init: RequestInit,
    preferredTargetId?: number | null
  ) => {
    if (!authToken) {
      return;
    }

    const response = await fetch(url, init);
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, ACTION_FAILURE_MESSAGE)
      );
    }

    const data: unknown = await response.json();
    if (
      !isFriendshipActionResponse(data) &&
      !isSocialSendResponse(data)
    ) {
      throw new Error(ACTION_FAILURE_MESSAGE);
    }

    await refresh(preferredTargetId);
    setStatusMessage(data.message);
  };

  const handlePetSwitch = () => {
    window.location.reload();
  };

  const handleSelectTarget = async (targetId: number) => {
    if (!petId || !authToken) {
      return;
    }
    setSelectedTargetId(targetId);
    try {
      setConversation(await readConversation(petId, authToken, targetId));
    } catch (error) {
      setConversation(null);
      setStatusMessage(
        error instanceof Error ? error.message : LOAD_FAILURE_MESSAGE
      );
    }
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!petId || !authToken || !selectedCandidate || !draftMessage.trim()) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/social/send`,
        {
          method: "POST",
          headers: buildAuthHeaders(authToken, true),
          body: JSON.stringify({
            targetPetId: selectedCandidate.pet.id,
            message: draftMessage.trim(),
          }),
        },
        selectedCandidate.pet.id
      );
      setDraftMessage("");
    });
  };

  const renderStatus = (candidate: SocialCandidate) => {
    if (candidate.friendshipStatus === "accepted") return "已是好友";
    if (candidate.friendshipStatus === "pending" && candidate.direction === "incoming") {
      return "待你处理";
    }
    if (candidate.friendshipStatus === "pending") return "已发请求";
    if (candidate.friendshipStatus === "rejected") return "可重新发起";
    return "未建立关系";
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/">返回首页</Link>
          <Link href="/my-pet">我的宠物</Link>
          <Link href="/chat">主人聊天</Link>
        </div>

        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">站内社交引擎</h1>
            <p className="mt-3 text-base leading-7 text-gray-600">
              当前宠物：{petName || "未选择"}。这里负责 Phase 2.5 的好友关系、站内消息和社交记录。
            </p>
          </div>
          {authToken && petId ? (
            <PetSwitcher
              currentPetId={petId}
              authToken={authToken}
              onPetSwitch={handlePetSwitch}
            />
          ) : null}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            正在加载社交数据...
          </div>
        ) : null}

        {!isLoading && !authToken ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-600">
            {statusMessage || LOGIN_REQUIRED_MESSAGE}
          </div>
        ) : null}

        {!isLoading && authToken && !petId ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-600">
            {statusMessage || "先创建宠物，再回来发起站内社交。"}
          </div>
        ) : null}

        {!isLoading && authToken && petId ? (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-gray-900">可互动宠物</h2>
                <button
                  type="button"
                  onClick={() =>
                    void runAction(async () => {
                      await postAndRefresh(
                        `${API_BASE_URL}/pets/${petId}/social/round`,
                        {
                          method: "POST",
                          headers: buildAuthHeaders(authToken),
                        }
                      );
                    })
                  }
                  disabled={isActing}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isActing ? "执行中..." : "来一轮社交"}
                </button>
              </div>

              {statusMessage ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {statusMessage}
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.pet.id}
                    className={`rounded-2xl border p-4 ${
                      selectedTargetId === candidate.pet.id
                        ? "border-amber-300 bg-white"
                        : "border-orange-100 bg-white/80"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectTarget(candidate.pet.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            {candidate.pet.petName}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {candidate.pet.species} · {candidate.pet.personality}
                          </p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                          {renderStatus(candidate)}
                        </span>
                      </div>
                    </button>

                    <p className="mt-3 text-sm text-gray-600">
                      {candidate.pet.specialTraits}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {candidate.canRequest ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(async () => {
                              await postAndRefresh(
                                `${API_BASE_URL}/pets/${petId}/friends/request`,
                                {
                                  method: "POST",
                                  headers: buildAuthHeaders(authToken, true),
                                  body: JSON.stringify({
                                    targetPetId: candidate.pet.id,
                                  }),
                                },
                                candidate.pet.id
                              );
                            })
                          }
                          disabled={isActing}
                          className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-60"
                        >
                          发好友请求
                        </button>
                      ) : null}

                      {candidate.friendshipStatus === "pending" &&
                      candidate.direction === "incoming" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(async () => {
                                await postAndRefresh(
                                  `${API_BASE_URL}/pets/${petId}/friends/${candidate.pet.id}/accept`,
                                  {
                                    method: "POST",
                                    headers: buildAuthHeaders(authToken),
                                  },
                                  candidate.pet.id
                                );
                              })
                            }
                            disabled={isActing}
                            className="rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-60"
                          >
                            接受
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(async () => {
                                await postAndRefresh(
                                  `${API_BASE_URL}/pets/${petId}/friends/${candidate.pet.id}/reject`,
                                  {
                                    method: "POST",
                                    headers: buildAuthHeaders(authToken),
                                  },
                                  candidate.pet.id
                                );
                              })
                            }
                            disabled={isActing}
                            className="rounded-lg bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800 disabled:opacity-60"
                          >
                            拒绝
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">当前对话</h2>
                <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                  {conversation ? (
                    <>
                      <div className="max-h-80 space-y-3 overflow-y-auto">
                        {conversation.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.senderPetId === petId
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                                message.senderPetId === petId
                                  ? "bg-gray-900 text-white"
                                  : "bg-white text-gray-700"
                              }`}
                            >
                              <p className="mb-1 text-xs opacity-70">
                                {message.senderPetId === petId
                                  ? petName
                                  : conversation.withPet.petName}
                              </p>
                              <p>{message.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedCandidate?.canChat ? (
                        <form onSubmit={handleSendMessage} className="mt-4 space-y-3">
                          <input
                            type="text"
                            value={draftMessage}
                            onChange={(event) => setDraftMessage(event.target.value)}
                            placeholder={`对 ${conversation.withPet.petName} 说点什么`}
                            disabled={isActing}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-500 disabled:opacity-60"
                          />
                          <button
                            type="submit"
                            disabled={isActing || !draftMessage.trim()}
                            className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                          >
                            发送站内消息
                          </button>
                        </form>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-sm text-gray-500">
                      {selectedCandidate
                        ? "这两只宠物还没有形成对话记录，可以先发好友请求或执行一轮社交。"
                        : "先从左侧选择一个目标。"}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">最近社交记录</h2>
                <div className="mt-4 space-y-3">
                  {tasks.slice(0, 8).map((item) => (
                    <div key={item.task.id} className="rounded-2xl bg-gray-50 px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {item.counterpartPet?.petName || "未知对象"} · {item.task.taskType}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        发起内容：{item.task.inputText}
                      </p>
                      {item.task.outputText ? (
                        <p className="mt-2 text-sm text-gray-500">
                          回复内容：{item.task.outputText}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">好友关系</h2>
                <div className="mt-4 space-y-3">
                  {friendships.map((item) => (
                    <div
                      key={`${item.friend.id}-${item.createdAt}`}
                      className="rounded-2xl bg-gray-50 px-4 py-4"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {item.friend.petName} · {item.status}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        {item.friend.species} · {item.friend.personality}
                      </p>
                      {item.lastMessagePreview ? (
                        <p className="mt-2 text-sm text-gray-500">
                          最近一条：{item.lastMessagePreview}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
