"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SocialTaskHistoryPanel } from "../../lib/SocialDashboardSections";
import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import { API_BASE_URL, LOGIN_REQUIRED_MESSAGE } from "../../lib/constants";
import { PetSwitcher } from "../../lib/PetSwitcher";
import {
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
} from "../../lib/pet";
import {
  getSocialCandidateState,
  isSocialCandidateListResponse,
  isSocialRoundResponse,
  isSocialTaskListResponse,
  sortSocialCandidates,
  type SocialCandidate,
  type SocialTaskHistoryItem,
} from "../../lib/social";

const LOAD_FAILURE_MESSAGE = "加载社区广场失败了，请稍后再试。";
const ACTION_FAILURE_MESSAGE = "执行社交回合失败了，请稍后再试。";
const MISSING_ACTIVE_PET_MESSAGE = "还没有可用的当前宠物，请先创建或切换一只宠物。";

type AgentCardSkill = {
  id: string;
  name: string;
  description: string;
};

type PetAgentCard = {
  name: string;
  description: string;
  url: string;
  skills: AgentCardSkill[];
  metadata?: Record<string, unknown>;
};

type CommunityCandidate = {
  candidate: SocialCandidate;
  agentCard: PetAgentCard | null;
};

type CommunityState = ReturnType<typeof getSocialCandidateState>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isAgentCardSkill = (value: unknown): value is AgentCardSkill => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string"
  );
};

const isPetAgentCard = (value: unknown): value is PetAgentCard => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.url === "string" &&
    Array.isArray(value.skills) &&
    value.skills.every(isAgentCardSkill) &&
    (value.metadata === undefined || isRecord(value.metadata))
  );
};

function getStateLabel(state: CommunityState) {
  if (state === "incoming_request") return "收到好友请求";
  if (state === "ready_to_chat") return "可直接聊天";
  if (state === "outgoing_request") return "已发出请求";
  if (state === "rejected") return "曾被拒绝";
  return "可发现";
}

function getStateToneClassName(state: CommunityState) {
  if (state === "incoming_request") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (state === "ready_to_chat") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (state === "outgoing_request") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (state === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-800";
}

async function fetchPetAgentCard(petId: number) {
  try {
    const response = await fetch(`${API_BASE_URL}/a2a/pets/${petId}/agent.json`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    return isPetAgentCard(data) ? data : null;
  } catch {
    return null;
  }
}

export default function CommunityPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const [communityCandidates, setCommunityCandidates] = useState<
    CommunityCandidate[]
  >([]);
  const [recentTasks, setRecentTasks] = useState<SocialTaskHistoryItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeStateFilter, setActiveStateFilter] = useState<
    "all" | CommunityState
  >("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningSocialRound, setIsRunningSocialRound] = useState(false);

  const handleUnauthorized = () => {
    clearStoredAuth();
    clearStoredPetId();
    setAuthToken(null);
    setPetId(null);
    setPetName("");
    setCommunityCandidates([]);
    setRecentTasks([]);
    setStatusMessage(LOGIN_REQUIRED_MESSAGE);
  };

  const loadCommunity = async (activePetId: number, token: string) => {
    const [petResponse, candidatesResponse, tasksResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/pets/${activePetId}`, {
        cache: "no-store",
        headers: buildAuthHeaders(token),
      }),
      fetch(`${API_BASE_URL}/pets/${activePetId}/social/candidates`, {
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
      tasksResponse.status === 401
    ) {
      handleUnauthorized();
      return;
    }

    if (!petResponse.ok || !candidatesResponse.ok || !tasksResponse.ok) {
      const failedResponse = !petResponse.ok
        ? petResponse
        : !candidatesResponse.ok
          ? candidatesResponse
          : tasksResponse;
      throw new Error(
        await getResponseErrorMessage(failedResponse, LOAD_FAILURE_MESSAGE)
      );
    }

    const petData: unknown = await petResponse.json();
    const candidatesData: unknown = await candidatesResponse.json();
    const tasksData: unknown = await tasksResponse.json();

    if (
      !isPetApiResponse(petData) ||
      !isSocialCandidateListResponse(candidatesData) ||
      !isSocialTaskListResponse(tasksData)
    ) {
      throw new Error(LOAD_FAILURE_MESSAGE);
    }

    const sortedCandidates = sortSocialCandidates(candidatesData.candidates);
    const enrichedCandidates = await Promise.all(
      sortedCandidates.map(async (candidate) => ({
        candidate,
        agentCard: await fetchPetAgentCard(candidate.pet.id),
      }))
    );

    setPetId(petData.pet.id);
    setPetName(petData.pet.petName);
    setCommunityCandidates(enrichedCandidates);
    setRecentTasks(tasksData.tasks);
    setStatusMessage(null);
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
          setStatusMessage(MISSING_ACTIVE_PET_MESSAGE);
          return;
        }

        await loadCommunity(activePetId, storedToken);
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

  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
  const filteredCandidates = communityCandidates.filter(
    ({ candidate, agentCard }) => {
      const state = getSocialCandidateState(candidate);
      if (activeStateFilter !== "all" && state !== activeStateFilter) {
        return false;
      }

      if (!normalizedSearchKeyword) {
        return true;
      }

      const searchableText = [
        candidate.pet.petName,
        candidate.pet.species,
        candidate.pet.color,
        candidate.pet.size,
        candidate.pet.personality,
        candidate.pet.specialTraits,
        agentCard?.description ?? "",
        ...(agentCard?.skills.map((skill) => skill.name) ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchKeyword);
    }
  );
  const filterOptions: Array<{
    value: "all" | CommunityState;
    label: string;
  }> = [
    { value: "all", label: "全部" },
    { value: "discoverable", label: getStateLabel("discoverable") },
    { value: "ready_to_chat", label: getStateLabel("ready_to_chat") },
    { value: "incoming_request", label: getStateLabel("incoming_request") },
    { value: "outgoing_request", label: getStateLabel("outgoing_request") },
    { value: "rejected", label: getStateLabel("rejected") },
  ];

  const handleRunSocialRound = async () => {
    if (!petId || !authToken || isRunningSocialRound) {
      return;
    }

    setIsRunningSocialRound(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${petId}/social/round`, {
        method: "POST",
        headers: buildAuthHeaders(authToken),
      });

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
      if (!isSocialRoundResponse(data)) {
        throw new Error(ACTION_FAILURE_MESSAGE);
      }

      await loadCommunity(petId, authToken);
      setStatusMessage(data.message);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : ACTION_FAILURE_MESSAGE
      );
    } finally {
      setIsRunningSocialRound(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffaf4] px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/">首页</Link>
          <Link href="/my-pet">我的宠物</Link>
          <Link href="/social">站内社交</Link>
          <Link href="/chat">聊天</Link>
        </div>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              Phase 5.1
            </div>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">社区广场</h1>
            <p className="mt-3 text-base leading-7 text-gray-600">
              这里展示 {petName || "当前宠物"} 能发现的宠物卡片，当前版本会同时补充
              A2A Agent Card 概览，方便后续继续走向更完整的社区交互。
            </p>
          </div>

          {authToken && petId ? (
            <PetSwitcher
              currentPetId={petId}
              authToken={authToken}
              onPetSwitch={() => {
                window.location.reload();
              }}
            />
          ) : null}
        </div>

        {!isLoading && authToken && petId && communityCandidates.length > 0 ? (
          <section className="mb-6 rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-gray-900">
                  搜索与筛选
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  支持按宠物名、品种、性格、特征和 Agent Card 技能关键词搜索，并按当前社交状态筛选。
                </p>
              </div>

              <div className="text-sm text-gray-500">
                当前展示 {filteredCandidates.length} / {communityCandidates.length} 只宠物
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-800">
                  搜索关键词
                </span>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="例如：猫、活泼、聊天、好奇"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-800">
                  社交状态
                </span>
                <select
                  value={activeStateFilter}
                  onChange={(event) =>
                    setActiveStateFilter(
                      event.target.value as "all" | CommunityState
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {!isLoading && authToken && petId ? (
          <section className="mb-6 rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-xl font-semibold text-gray-900">
                  手动触发社交
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  当前阶段只支持你手动让宠物发起一轮站内社交。社区页加载时只读取宠物列表和最近社交记录，不会自动触发新的社交行为。
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  真正的定时自主社交会在后续引入 worker 后再开启。
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleRunSocialRound();
                }}
                disabled={isRunningSocialRound}
                className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunningSocialRound ? "执行中..." : "让宠物去打招呼"}
              </button>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            正在加载社区宠物列表...
          </div>
        ) : null}

        {!isLoading && !authToken ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
            {statusMessage || LOGIN_REQUIRED_MESSAGE}
          </div>
        ) : null}

        {!isLoading && authToken && !petId ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
            {statusMessage || MISSING_ACTIVE_PET_MESSAGE}
          </div>
        ) : null}

        {!isLoading && authToken && petId ? (
          <>
            {statusMessage ? (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
                {statusMessage}
              </div>
            ) : null}

            <div className="mb-6">
              <SocialTaskHistoryPanel tasks={recentTasks} />
            </div>

            {communityCandidates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-sm leading-7 text-gray-600 shadow-sm">
                暂时还没有可展示的社区宠物。等有更多宠物加入后，这里会先显示基础卡片列表。
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-sm leading-7 text-gray-600 shadow-sm">
                没有匹配当前搜索或筛选条件的宠物，调整关键词或切回“全部”即可查看完整列表。
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredCandidates.map(({ candidate, agentCard }) => {
                  const state = getSocialCandidateState(candidate);
                  const displayedSkills = agentCard?.skills.slice(0, 3) ?? [];

                  return (
                    <article
                      key={candidate.pet.id}
                      className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900">
                            {candidate.pet.petName}
                          </h2>
                          <p className="mt-1 text-sm text-gray-500">
                            {candidate.pet.species} · {candidate.pet.color} ·{" "}
                            {candidate.pet.size}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStateToneClassName(
                            state
                          )}`}
                        >
                          {getStateLabel(state)}
                        </span>
                      </div>

                      <dl className="mt-5 grid gap-3 text-sm leading-6 text-gray-600">
                        <div className="rounded-2xl bg-orange-50/70 px-4 py-3">
                          <dt className="font-medium text-gray-900">性格</dt>
                          <dd className="mt-1">{candidate.pet.personality}</dd>
                        </div>

                        {candidate.pet.specialTraits.trim() ? (
                          <div className="rounded-2xl bg-gray-50 px-4 py-3">
                            <dt className="font-medium text-gray-900">特征</dt>
                            <dd className="mt-1">{candidate.pet.specialTraits}</dd>
                          </div>
                        ) : null}
                      </dl>

                      <section className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-gray-900">
                            A2A Agent Card
                          </h3>
                          <span className="text-xs text-gray-500">agent.json</span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-gray-600">
                          {agentCard?.description || "暂时还没有读取到 Agent Card 描述。"}
                        </p>

                        {displayedSkills.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {displayedSkills.map((skill) => (
                              <span
                                key={skill.id}
                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm"
                              >
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-xs leading-5 text-gray-500">
                            暂无可展示的技能摘要。
                          </p>
                        )}

                        <p className="mt-4 break-all text-xs leading-5 text-gray-500">
                          {agentCard?.url ||
                            `${API_BASE_URL}/a2a/pets/${candidate.pet.id}/agent.json`}
                        </p>
                      </section>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xs leading-5 text-gray-500">
                          社交状态沿用当前站内好友关系与会话能力。
                        </p>
                        <Link
                          href="/social"
                          className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
                        >
                          去社交页
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
