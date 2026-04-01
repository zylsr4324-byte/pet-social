"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthSessionNotice } from "../../lib/AuthSessionNotice";
import {
  SocialConversationPanel,
  SocialFriendshipsPanel,
  SocialTargetsPanel,
  SocialTaskHistoryPanel,
} from "../../lib/SocialDashboardSections";
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
  sortSocialCandidates,
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

    const sortedCandidates = sortSocialCandidates(candidatesData.candidates);

    setPetId(petData.pet.id);
    setPetName(petData.pet.petName);
    setCandidates(sortedCandidates);
    setFriendships(friendsData.friends);
    setTasks(tasksData.tasks);

    const nextTargetId =
      preferredTargetId &&
      sortedCandidates.some((item) => item.pet.id === preferredTargetId)
        ? preferredTargetId
        : sortedCandidates[0]?.pet.id ?? null;

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
    if (!isFriendshipActionResponse(data) && !isSocialSendResponse(data)) {
      throw new Error(ACTION_FAILURE_MESSAGE);
    }

    await refresh(preferredTargetId);
    setStatusMessage(data.message);
  };

  const handlePetSwitch = () => {
    window.location.reload();
  };

  const handleRunSocialRound = async () => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(`${API_BASE_URL}/pets/${petId}/social/round`, {
        method: "POST",
        headers: buildAuthHeaders(authToken),
      });
    });
  };

  const handleRequestFriendship = async (targetPetId: number) => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/friends/request`,
        {
          method: "POST",
          headers: buildAuthHeaders(authToken, true),
          body: JSON.stringify({
            targetPetId,
          }),
        },
        targetPetId
      );
    });
  };

  const handleAcceptFriendship = async (friendId: number) => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/friends/${friendId}/accept`,
        {
          method: "POST",
          headers: buildAuthHeaders(authToken),
        },
        friendId
      );
    });
  };

  const handleRejectFriendship = async (friendId: number) => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/friends/${friendId}/reject`,
        {
          method: "POST",
          headers: buildAuthHeaders(authToken),
        },
        friendId
      );
    });
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

  const handleSendMessage = async () => {
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

        <AuthSessionNotice authToken={authToken} className="mb-8" />

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
            <SocialTargetsPanel
              candidates={candidates}
              selectedTargetId={selectedTargetId}
              statusMessage={statusMessage}
              isActing={isActing}
              onRunSocialRound={() => void handleRunSocialRound()}
              onSelectTarget={(targetId) => void handleSelectTarget(targetId)}
              onRequestFriendship={(targetId) =>
                void handleRequestFriendship(targetId)
              }
              onAcceptFriendship={(friendId) =>
                void handleAcceptFriendship(friendId)
              }
              onRejectFriendship={(friendId) =>
                void handleRejectFriendship(friendId)
              }
            />

            <div className="space-y-6">
              <SocialConversationPanel
                petId={petId}
                petName={petName}
                selectedCandidate={selectedCandidate}
                conversation={conversation}
                draftMessage={draftMessage}
                isActing={isActing}
                onDraftMessageChange={setDraftMessage}
                onSendMessage={() => void handleSendMessage()}
              />
              <SocialTaskHistoryPanel tasks={tasks} />
              <SocialFriendshipsPanel friendships={friendships} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
