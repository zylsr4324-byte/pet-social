"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import {
  API_BASE_URL,
  LOGIN_REQUIRED_MESSAGE,
  RESTORE_PET_FAILURE_MESSAGE,
} from "../../lib/constants";
import {
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
  type ApiPet,
} from "../../lib/pet";
import type { SceneAction } from "../../lib/PetHomeScene";
import {
  getHomeSceneBehavior,
  HOME_SCENE_OBJECTS,
  type HomeSceneObjectAction,
  type HomeSceneObjectMeta,
} from "../../lib/home-scene";
import {
  createHomePageNotice,
  createHomeStatusSyncNotice,
  createPetSelectionSceneNotice,
  createSceneActionErrorNotice,
  createSceneActionNetworkNotice,
  createSceneActionSuccessNotice,
  createSceneTargetNotice,
  getHomeStatusSyncNoticeClassName,
  getHomeSceneNoticeClassName,
  getNoticeAutoDismissMs,
  type HomePageNotice,
  type HomeSceneNotice,
  type HomeStatusSyncNotice,
} from "../../lib/home-scene-notice";
import {
  PetStatusPanel,
  type PetStatus,
  isPetStatus,
} from "../../lib/PetStatusPanel";
import { PetSwitcher } from "../../lib/PetSwitcher";

const PetHomeScene = dynamic(
  () =>
    import("../../lib/PetHomeScene").then((module) => ({
      default: module.PetHomeScene,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square w-full rounded-[28px] border border-orange-200 bg-[#fff7ed] p-6 text-sm text-amber-700">
        正在加载家庭场景...
      </div>
    ),
  }
);

const HOME_LOAD_FAILURE_MESSAGE = "加载家庭场景失败，请稍后再试。";
const SCENE_OBJECT_ENTRIES = Object.entries(HOME_SCENE_OBJECTS) as Array<
  [HomeSceneObjectAction, HomeSceneObjectMeta]
>;
const INSTANT_OBJECT_LABELS = SCENE_OBJECT_ENTRIES.filter(
  ([, item]) => item.interactionKind === "instant"
)
  .map(([, item]) => item.label)
  .join(" / ");
const TARGET_OBJECT_LABELS = SCENE_OBJECT_ENTRIES.filter(
  ([, item]) => item.interactionKind === "target"
)
  .map(([, item]) => item.label)
  .join(" / ");

function getObjectBadgeClass(kind: HomeSceneObjectMeta["interactionKind"]) {
  return kind === "instant"
    ? "bg-amber-100 text-amber-800"
    : "bg-violet-100 text-violet-800";
}

type StatusFetchResult =
  | { kind: "success"; status: PetStatus }
  | { kind: "unauthorized" }
  | { kind: "failed" };

export default function HomeScenePage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pet, setPet] = useState<ApiPet | null>(null);
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPetPanelOpen, setIsPetPanelOpen] = useState(false);
  const [pageStatusNotice, setPageStatusNotice] =
    useState<HomePageNotice | null>(null);
  const [sceneNotice, setSceneNotice] = useState<HomeSceneNotice | null>(null);
  const [statusSyncNotice, setStatusSyncNotice] =
    useState<HomeStatusSyncNotice | null>(null);

  const applyStatusSnapshot = (nextStatus: PetStatus) => {
    setStatus(nextStatus);
    setStatusSyncNotice(null);
  };

  const fetchPetStatus = useEffectEvent(async (
    activePetId: number,
    token: string
  ): Promise<StatusFetchResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/pets/${activePetId}/status`, {
        cache: "no-store",
        headers: buildAuthHeaders(token),
      });

      if (response.status === 401) {
        clearStoredAuth();
        clearStoredPetId();
        setAuthToken(null);
        setPet(null);
        setStatus(null);
        setStatusSyncNotice(null);
        setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
        return { kind: "unauthorized" };
      }

      if (!response.ok) {
        return { kind: "failed" };
      }

      const data: unknown = await response.json();
      if (!isPetStatus(data)) {
        return { kind: "failed" };
      }

      applyStatusSnapshot(data);
      return { kind: "success", status: data };
    } catch {
      return { kind: "failed" };
    }
  });

  const pollPetStatus = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    const result = await fetchPetStatus(activePetId, token);
    if (result.kind === "failed") {
      setStatusSyncNotice(createHomeStatusSyncNotice());
    }
  });

  useEffect(() => {
    let isMounted = true;

    const loadHomePage = async () => {
      try {
        const storedAuthToken = readStoredAuthToken();
        if (!storedAuthToken) {
          if (isMounted) {
            setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
          }
          return;
        }

        if (isMounted) {
          setAuthToken(storedAuthToken);
        }

        let activePetId = readStoredPetId();
        if (!activePetId) {
          const restoreResult = await recoverLatestPetForCurrentUser(
            storedAuthToken,
            RESTORE_PET_FAILURE_MESSAGE
          );

          if (restoreResult.unauthorized) {
            if (isMounted) {
              setPageStatusNotice(
                createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info")
              );
              clearStoredAuth();
            }
            return;
          }

          activePetId = restoreResult.pet?.id ?? null;
        }

        if (!activePetId) {
          if (isMounted) {
            setPageStatusNotice(
              createHomePageNotice("你还没有宠物，先去创建一只再进入家庭场景。")
            );
          }
          return;
        }

        const petResponse = await fetch(`${API_BASE_URL}/pets/${activePetId}`, {
          cache: "no-store",
          headers: buildAuthHeaders(storedAuthToken),
        });

        if (petResponse.status === 401) {
          if (isMounted) {
            clearStoredAuth();
            clearStoredPetId();
            setPageStatusNotice(
              createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info")
            );
          }
          return;
        }

        if (!petResponse.ok) {
          if (isMounted) {
            setPageStatusNotice(
              createHomePageNotice(
                await getResponseErrorMessage(
                  petResponse,
                  HOME_LOAD_FAILURE_MESSAGE
                )
              )
            );
          }
          return;
        }

        const petData: unknown = await petResponse.json();
        if (!isPetApiResponse(petData)) {
          if (isMounted) {
            setPageStatusNotice(
              createHomePageNotice("后端返回的宠物数据格式不正确。")
            );
          }
          return;
        }

        if (isMounted) {
          setPet(petData.pet);
          setPageStatusNotice(null);
        }

        const statusResult = await fetchPetStatus(petData.pet.id, storedAuthToken);
        if (isMounted && statusResult.kind === "failed") {
          setStatusSyncNotice(createHomeStatusSyncNotice());
        }
      } catch {
        if (isMounted) {
          setPageStatusNotice(createHomePageNotice(HOME_LOAD_FAILURE_MESSAGE));
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    void loadHomePage();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pet || !authToken) {
      setStatusSyncNotice(null);
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollPetStatus(pet.id, authToken);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authToken, pet]);

  useEffect(() => {
    if (!sceneNotice) {
      return;
    }

    const dismissAfterMs = getNoticeAutoDismissMs(sceneNotice.scope);
    if (!dismissAfterMs) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSceneNotice(null);
    }, dismissAfterMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [sceneNotice]);

  const handlePetSwitch = (_newPetId: number) => {
    void _newPetId;
    window.location.reload();
  };

  const handleSceneAction = async (action: SceneAction) => {
    if (!pet || !authToken) {
      return;
    }

    if (action === "pet") {
      setIsPetPanelOpen(true);
      setSceneNotice(createPetSelectionSceneNotice());
      return;
    }

    if (action === "bed") {
      setIsPetPanelOpen(true);
      setSceneNotice(createSceneTargetNotice(action));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${pet.id}/${action}`, {
        method: "POST",
        headers: buildAuthHeaders(authToken),
      });

      if (!response.ok) {
        setSceneNotice(
          createSceneActionErrorNotice(
            action,
            await getResponseErrorMessage(
              response,
              `${HOME_SCENE_OBJECTS[action].label}互动失败，请稍后再试。`
            )
          )
        );
        return;
      }

      const data: unknown = await response.json();
      if (
        data &&
        typeof data === "object" &&
        "status" in data &&
        isPetStatus((data as { status?: unknown }).status)
      ) {
        applyStatusSnapshot((data as { status: PetStatus }).status);
      }

      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message?: unknown }).message === "string"
      ) {
        setSceneNotice(
          createSceneActionSuccessNotice(
            action,
            (data as { message: string }).message
          )
        );
      } else {
        setSceneNotice(createSceneActionSuccessNotice(action));
      }
    } catch {
      setSceneNotice(createSceneActionNetworkNotice(action));
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">
            返回首页
          </Link>
          <Link href="/my-pet" className="transition hover:text-gray-800">
            我的宠物
          </Link>
          <Link href="/chat" className="transition hover:text-gray-800">
            宠物聊天
          </Link>
          <Link href="/social" className="transition hover:text-gray-800">
            站内社交
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-700">
              Phase 3 · 2D 家庭场景
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              家庭场景主页
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              这是当前宠物的俯视角家庭场景。宠物会根据状态主动走向食盆、水盆或床；点击宠物只负责打开状态面板，固定物件则分成“立即互动”和“行为目标点”两类。
            </p>
          </div>

          {authToken && pet ? (
            <PetSwitcher
              currentPetId={pet.id}
              authToken={authToken}
              onPetSwitch={handlePetSwitch}
            />
          ) : null}
        </div>

        {!isLoaded ? (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            正在加载家庭场景...
          </section>
        ) : null}

        {isLoaded && !authToken ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8">
            <h2 className="text-2xl font-semibold text-gray-900">请先登录</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {pageStatusNotice?.text || LOGIN_REQUIRED_MESSAGE}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              去登录
            </Link>
          </section>
        ) : null}

        {isLoaded && authToken && !pet ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8">
            <h2 className="text-2xl font-semibold text-gray-900">
              还没有家庭场景主角
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {pageStatusNotice?.text || "先创建宠物，再回来体验家庭场景。"}
            </p>
            <Link
              href="/create-pet"
              className="mt-6 inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              去创建宠物
            </Link>
          </section>
        ) : null}

        {isLoaded && authToken && pet ? (
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <section className="rounded-[32px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-amber-700">
                    当前宠物：{pet.petName}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                    俯视角家庭地图
                  </h2>
                </div>

                <div className="rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-medium text-amber-700 shadow-sm">
                  {getHomeSceneBehavior(status).summary}
                </div>
              </div>

              <PetHomeScene
                petName={pet.petName}
                petStatus={status}
                onAction={(action) => {
                  void handleSceneAction(action);
                }}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SCENE_OBJECT_ENTRIES.map(([action, item]) => (
                  <div
                    key={action}
                    className="rounded-2xl bg-white/80 p-4 text-sm text-gray-600 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getObjectBadgeClass(item.interactionKind)}`}
                      >
                        {item.badgeLabel}
                      </span>
                    </div>
                    <p className="mt-2 leading-6">{item.panelDescription}</p>
                  </div>
                ))}
              </div>

              {statusSyncNotice ? (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${getHomeStatusSyncNoticeClassName(statusSyncNotice.tone)}`}
                >
                  {statusSyncNotice.text}
                </div>
              ) : null}

              {sceneNotice ? (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${getHomeSceneNoticeClassName(sceneNotice.tone)}`}
                >
                  {sceneNotice.text}
                </div>
              ) : null}
            </section>

            <div className="space-y-6">
              <section className="rounded-[32px] border border-orange-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      场景说明
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      点击宠物只会展开状态面板；固定物件则分成两类：立即互动点会直接调用接口，行为目标点只负责解释宠物当前会往哪里移动。
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPetPanelOpen((open) => !open)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                    >
                      {isPetPanelOpen ? "收起状态面板" : "打开状态面板"}
                    </button>
                    <Link
                      href="/chat"
                      className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
                    >
                      去和 {pet.petName} 聊天
                    </Link>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-600">
                  <p>房间布局：左上客厅，右上厨房，右下卧室。</p>
                  <p>
                    行为规则：饥饿优先找食盆，口渴优先找水盆，疲惫优先找床，否则在房间里巡视。
                  </p>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-7 text-gray-600 md:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">立即互动</p>
                    <p className="mt-2">
                      {INSTANT_OBJECT_LABELS}
                      会在点击后马上调用后端接口，属于直接结算当前动作的交互点。
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">行为目标点</p>
                    <p className="mt-2">
                      {TARGET_OBJECT_LABELS}
                      当前只负责表达宠物的移动目标和休息语义，不会立刻写入新的数值结果。
                    </p>
                  </div>
                </div>
              </section>

              {isPetPanelOpen ? (
                <PetStatusPanel
                  petId={pet.id}
                  authToken={authToken}
                  status={status}
                  onStatusChange={applyStatusSnapshot}
                />
              ) : (
                <section className="rounded-[32px] border border-dashed border-gray-200 bg-gray-50 p-6 text-sm leading-7 text-gray-500">
                  点击场景里的宠物，或者点右上按钮，就会打开状态面板。聊天请使用独立的聊天入口。
                </section>
              )}

              <section className="rounded-[32px] border border-orange-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  独立页面入口
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  家庭场景只处理地图移动和固定物件互动，其它能力继续保持独立页面入口。
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/chat"
                    className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
                  >
                    去聊天窗口
                  </Link>
                  <Link
                    href="/my-pet"
                    className="inline-flex rounded-lg bg-amber-100 px-5 py-3 text-sm font-medium text-amber-800 transition hover:bg-amber-200"
                  >
                    查看宠物资料
                  </Link>
                  <Link
                    href="/social"
                    className="inline-flex rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                  >
                    去站内社交
                  </Link>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
