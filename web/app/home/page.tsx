"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { AuthSessionNotice } from "../../lib/AuthSessionNotice";
import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import {
  type ChatMessage,
  isChatResponse,
  isMessageListResponse,
} from "../../lib/chat";
import {
  API_BASE_URL,
  LOGIN_REQUIRED_MESSAGE,
  MISSING_PET_MESSAGE,
  RESTORE_PET_FAILURE_MESSAGE,
} from "../../lib/constants";
import {
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  isPetListResponse,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
  type ApiPet,
} from "../../lib/pet";
import type { SceneAction } from "../../lib/PetHomeScene";
import {
  moveFurniture,
  type PlacedFurnitureResponse,
  isPlacedFurnitureListResponse,
} from "../../lib/furniture";
import {
  HOME_SCENE_ROOMS,
  HOME_PET_INTERACTION_MENU_ITEMS,
  HOME_SCENE_OBJECTS,
  type HomeSocialEmotion,
  type HomeRoomId,
  type HomeSceneObjectAction,
  type HomeSceneObjectMeta,
  type PetInteractionMenuAction,
} from "../../lib/home-scene";
import {
  buildHomeStatusFreshnessText,
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
import {
  getHomeStatusDisplayPolicy,
  getHomeStatusSummaryText,
  type PetStatusViewState,
} from "../../lib/pet-status-view";
import { AppHeaderNav } from "../../lib/AppHeaderNav";
import { ui } from "../../lib/ui";

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
const HOME_CHAT_LOAD_FAILURE_MESSAGE = "加载家庭场景聊天记录失败，请稍后再试。";
const HOME_CHAT_SEND_FAILURE_MESSAGE = "发送聊天消息失败，请稍后再试。";
const HOME_CHAT_SEND_TIMEOUT_MS = 8000;
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
  | { kind: "success" }
  | { kind: "unauthorized" }
  | { kind: "failed" };

function clonePlacedFurnitureItems(items: PlacedFurnitureResponse[]) {
  return items.map((item) => ({
    ...item,
    template: { ...item.template },
  }));
}

function normalizeHomeSocialEmotion(value: string | null): HomeSocialEmotion | null {
  if (
    value === "calm" ||
    value === "curious" ||
    value === "guarded" ||
    value === "excited" ||
    value === "warm"
  ) {
    return value;
  }
  return null;
}

export default function HomeScenePage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pet, setPet] = useState<ApiPet | null>(null);
  const [pets, setPets] = useState<ApiPet[]>([]);
  const [petStatuses, setPetStatuses] = useState<Map<number, PetStatus>>(new Map());
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurnitureResponse[]>([]);
  const [currentRoom, setCurrentRoom] = useState<HomeRoomId>("living");
  const [isFurnitureEditMode, setIsFurnitureEditMode] = useState(false);
  const [isFurnitureLayoutSaving, setIsFurnitureLayoutSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPetMenuOpen, setIsPetMenuOpen] = useState(false);
  const [activePetPanel, setActivePetPanel] = useState<
    PetInteractionMenuAction | null
  >(null);
  const [pageStatusNotice, setPageStatusNotice] =
    useState<HomePageNotice | null>(null);
  const [sceneNotice, setSceneNotice] = useState<HomeSceneNotice | null>(null);
  const [statusSyncNotice, setStatusSyncNotice] =
    useState<HomeStatusSyncNotice | null>(null);
  const [lastStatusSyncedAt, setLastStatusSyncedAt] = useState<number | null>(null);
  const [statusViewState, setStatusViewState] =
    useState<PetStatusViewState>("loading");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState("");
  const [isHomeChatLoading, setIsHomeChatLoading] = useState(false);
  const [isHomeChatLoaded, setIsHomeChatLoaded] = useState(false);
  const [isHomeChatSending, setIsHomeChatSending] = useState(false);
  const [homeChatStatusMessage, setHomeChatStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const furnitureBaselineRef = useRef<PlacedFurnitureResponse[] | null>(null);
  const isPetPanelOpen = activePetPanel === "status";
  const isHomeChatOpen = activePetPanel === "chat";
  const currentRoomMeta =
    HOME_SCENE_ROOMS.find((room) => room.id === currentRoom) ?? HOME_SCENE_ROOMS[0];
  const statusDisplayPolicy = getHomeStatusDisplayPolicy(
    status,
    statusViewState,
    isPetPanelOpen
  );
  const canSendHomeChatMessage = Boolean(
    chatInputValue.trim() &&
      pet &&
      authToken &&
      isHomeChatOpen &&
      !isHomeChatLoading &&
      !isHomeChatSending
  );

  const applyStatusSnapshot = (nextStatus: PetStatus) => {
    setStatus(nextStatus);
    setStatusSyncNotice(null);
    setLastStatusSyncedAt(Date.now());
    setStatusViewState("ready");
  };

  const resetHomeChatState = () => {
    setChatMessages([]);
    setChatInputValue("");
    setIsHomeChatLoading(false);
    setIsHomeChatLoaded(false);
    setIsHomeChatSending(false);
    setHomeChatStatusMessage(null);
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
        setIsPetMenuOpen(false);
        setActivePetPanel(null);
        setStatusSyncNotice(null);
        setLastStatusSyncedAt(null);
        setStatusViewState("loading");
        resetHomeChatState();
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
      return { kind: "success" };
    } catch {
      return { kind: "failed" };
    }
  });

  const fetchPlacedFurniture = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pets/${activePetId}/furniture`, {
        cache: "no-store",
        headers: buildAuthHeaders(token),
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (isPlacedFurnitureListResponse(data)) {
        setPlacedFurniture(data.items);
      }
    } catch {
      // ignore
    }
  });

  const pollPetStatus = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    const result = await fetchPetStatus(activePetId, token);
    if (result.kind === "failed") {
      if (status) {
        setStatusSyncNotice(createHomeStatusSyncNotice());
      } else {
        setStatusSyncNotice(null);
        setStatusViewState("unavailable");
      }
    }
  });

  const loadHomeChatMessages = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    setIsHomeChatLoading(true);
    setHomeChatStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${activePetId}/messages`, {
        cache: "no-store",
        headers: buildAuthHeaders(token),
      });

      if (response.status === 401) {
        clearStoredAuth();
        clearStoredPetId();
        setAuthToken(null);
        setPet(null);
        setStatus(null);
        setIsPetMenuOpen(false);
        setActivePetPanel(null);
        setStatusSyncNotice(null);
        setLastStatusSyncedAt(null);
        setStatusViewState("loading");
        resetHomeChatState();
        setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
        return;
      }

      if (response.status === 404) {
        clearStoredPetId();
        setChatMessages([]);
        setHomeChatStatusMessage({
          type: "error",
          message: MISSING_PET_MESSAGE,
        });
        setIsHomeChatLoaded(true);
        return;
      }

      if (!response.ok) {
        setHomeChatStatusMessage({
          type: "error",
          message: await getResponseErrorMessage(
            response,
            HOME_CHAT_LOAD_FAILURE_MESSAGE
          ),
        });
        setIsHomeChatLoaded(true);
        return;
      }

      const data: unknown = await response.json();
      if (!isMessageListResponse(data)) {
        setChatMessages([]);
        setHomeChatStatusMessage({
          type: "error",
          message: "后端返回的聊天记录格式不正确。",
        });
        setIsHomeChatLoaded(true);
        return;
      }

      setChatMessages(data.messages);
      setHomeChatStatusMessage(null);
      setIsHomeChatLoaded(true);
    } catch {
      setChatMessages([]);
      setHomeChatStatusMessage({
        type: "error",
        message: HOME_CHAT_LOAD_FAILURE_MESSAGE,
      });
      setIsHomeChatLoaded(true);
    } finally {
      setIsHomeChatLoading(false);
    }
  });

  const sendHomeChatMessage = async () => {
    const trimmedMessage = chatInputValue.trim();

    if (
      !trimmedMessage ||
      !pet ||
      !authToken ||
      !isHomeChatOpen ||
      isHomeChatLoading ||
      isHomeChatSending
    ) {
      return;
    }

    setIsHomeChatSending(true);
    setHomeChatStatusMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, HOME_CHAT_SEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${pet.id}/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: buildAuthHeaders(authToken, true),
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      if (response.status === 401) {
        clearStoredAuth();
        clearStoredPetId();
        setAuthToken(null);
        setPet(null);
        setStatus(null);
        setIsPetMenuOpen(false);
        setActivePetPanel(null);
        setStatusSyncNotice(null);
        setLastStatusSyncedAt(null);
        setStatusViewState("loading");
        resetHomeChatState();
        setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
        return;
      }

      if (response.status === 404) {
        clearStoredPetId();
        setHomeChatStatusMessage({
          type: "error",
          message: MISSING_PET_MESSAGE,
        });
        return;
      }

      if (!response.ok) {
        setHomeChatStatusMessage({
          type: "error",
          message: await getResponseErrorMessage(
            response,
            HOME_CHAT_SEND_FAILURE_MESSAGE
          ),
        });
        return;
      }

      const data: unknown = await response.json();
      if (!isChatResponse(data)) {
        setHomeChatStatusMessage({
          type: "error",
          message: "后端返回的聊天数据格式不正确。",
        });
        return;
      }

      setChatMessages((currentMessages) => [
        ...currentMessages,
        data.user_message,
        data.pet_message,
      ]);
      setChatInputValue("");
      setHomeChatStatusMessage(null);
    } catch {
      setHomeChatStatusMessage({
        type: "error",
        message: HOME_CHAT_SEND_FAILURE_MESSAGE,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsHomeChatSending(false);
    }
  };

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
          setStatusViewState("loading");
        }

        const statusResult = await fetchPetStatus(petData.pet.id, storedAuthToken);
        if (isMounted && statusResult.kind === "failed") {
          setStatusSyncNotice(null);
          setStatusViewState("unavailable");
        }
        void fetchPlacedFurniture(petData.pet.id, storedAuthToken);

        // 加载所有宠物列表及各自状态
        try {
          const allPetsRes = await fetch(`${API_BASE_URL}/pets`, {
            cache: "no-store",
            headers: buildAuthHeaders(storedAuthToken),
          });
          if (allPetsRes.ok && isMounted) {
            const allPetsData: unknown = await allPetsRes.json();
            if (isPetListResponse(allPetsData)) {
              setPets(allPetsData.pets);
              // 并发获取所有宠物状态
              const statusMap = new Map<number, PetStatus>();
              await Promise.all(
                allPetsData.pets.map(async (p) => {
                  try {
                    const sRes = await fetch(`${API_BASE_URL}/pets/${p.id}/status`, {
                      cache: "no-store",
                      headers: buildAuthHeaders(storedAuthToken),
                    });
                    if (sRes.ok) {
                      const sData: unknown = await sRes.json();
                      if (isPetStatus(sData)) statusMap.set(p.id, sData);
                    }
                  } catch { /* ignore */ }
                })
              );
              if (isMounted) setPetStatuses(statusMap);
            }
          }
        } catch { /* ignore */ }

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
      setIsFurnitureEditMode(false);
      setIsFurnitureLayoutSaving(false);
      furnitureBaselineRef.current = null;
      setIsPetMenuOpen(false);
      setActivePetPanel(null);
      setStatusSyncNotice(null);
      setLastStatusSyncedAt(null);
      setStatusViewState("loading");
      resetHomeChatState();
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
    if (
      !isHomeChatOpen ||
      !pet ||
      !authToken ||
      isHomeChatLoaded ||
      isHomeChatLoading
    ) {
      return;
    }

    void loadHomeChatMessages(pet.id, authToken);
  }, [
    authToken,
    isHomeChatLoaded,
    isHomeChatLoading,
    isHomeChatOpen,
    pet,
  ]);

  useEffect(() => {
    if (!isHomeChatOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const messagesContainer = chatMessagesContainerRef.current;

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
  }, [chatMessages, isHomeChatOpen]);

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

  const handleFurnitureDraftChange = (nextFurniture: PlacedFurnitureResponse[]) => {
    setPlacedFurniture(clonePlacedFurnitureItems(nextFurniture));
  };

  const handleFurnitureEditError = (message: string) => {
    setSceneNotice({
      scope: "scene",
      tone: "error",
      text: message,
    });
  };

  const saveFurnitureLayout = async () => {
    if (!pet || !authToken) {
      return false;
    }

    const baseline = furnitureBaselineRef.current;
    if (!baseline) {
      setIsFurnitureEditMode(false);
      return true;
    }

    const changedItems = placedFurniture.filter((item) => {
      const previous = baseline.find((candidate) => candidate.id === item.id);
      if (!previous) {
        return true;
      }
      return (
        previous.room !== item.room ||
        previous.tile_x !== item.tile_x ||
        previous.tile_y !== item.tile_y ||
        previous.rotation !== item.rotation ||
        previous.flipped !== item.flipped
      );
    });

    if (changedItems.length === 0) {
      furnitureBaselineRef.current = null;
      setIsFurnitureEditMode(false);
      return true;
    }

    setIsFurnitureLayoutSaving(true);

    try {
      const savedItems = await Promise.all(
        changedItems.map((item) =>
          moveFurniture(
            pet.id,
            authToken,
            item.id,
            item.room,
            item.tile_x,
            item.tile_y,
            item.rotation,
            item.flipped
          )
        )
      );

      const savedItemMap = new Map(savedItems.map((item) => [item.id, item]));
      setPlacedFurniture((currentItems) =>
        currentItems.map((item) => savedItemMap.get(item.id) ?? item)
      );
      furnitureBaselineRef.current = null;
      setIsFurnitureEditMode(false);
      setSceneNotice({
        scope: "scene",
        tone: "success",
        text: "家具布局已自动保存。",
      });
      return true;
    } catch (error) {
      setSceneNotice({
        scope: "scene",
        tone: "error",
        text: error instanceof Error ? error.message : "保存家具布局失败，请稍后再试。",
      });
      return false;
    } finally {
      setIsFurnitureLayoutSaving(false);
    }
  };

  const handleFurnitureEditToggle = async () => {
    if (!pet || !authToken || isFurnitureLayoutSaving) {
      return;
    }

    if (!isFurnitureEditMode) {
      furnitureBaselineRef.current = clonePlacedFurnitureItems(placedFurniture);
      setIsFurnitureEditMode(true);
      setSceneNotice({
        scope: "scene",
        tone: "info",
        text: "已进入布置模式。拖拽家具会吸附网格，双击可旋转，退出时自动保存。",
      });
      return;
    }

    await saveFurnitureLayout();
  };

  const handleSceneAction = async (action: SceneAction) => {
    if (!pet || !authToken) {
      return;
    }

    if (isFurnitureEditMode && action !== "pet") {
      return;
    }

    if (action === "pet") {
      setIsPetMenuOpen(true);
      setSceneNotice(createPetSelectionSceneNotice());
      return;
    }

    if (action === "bed") {
      setActivePetPanel("status");
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

  const handlePetMenuAction = (action: PetInteractionMenuAction) => {
    setIsPetMenuOpen(false);
    if (action === "chat") {
      setIsHomeChatLoaded(false);
    }
    setActivePetPanel(action);
  };

  const handleHomeChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendHomeChatMessage();
  };

  const handleHomeChatInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!canSendHomeChatMessage) {
      return;
    }

    void sendHomeChatMessage();
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <AppHeaderNav />

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-700">
              Phase 3 · 2D 家庭场景
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              家庭场景主页
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              这里是宠物的家庭场景，可以直接互动、聊天和调整家具。
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

        <AuthSessionNotice authToken={authToken} className="mb-8" />

        {!isLoaded ? (
          <section className={`${ui.cardSoft} p-6 text-sm text-gray-600`}>
            正在加载家庭场景...
          </section>
        ) : null}

        {isLoaded && !authToken ? (
          <section className={`${ui.cardGhost} p-8`}>
            <h2 className="text-2xl font-semibold text-gray-900">请先登录</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {pageStatusNotice?.text || LOGIN_REQUIRED_MESSAGE}
            </p>
            <Link
              href="/login"
              className={`mt-6 ${ui.buttonPrimary}`}
            >
              去登录
            </Link>
          </section>
        ) : null}

        {isLoaded && authToken && !pet ? (
          <section className={`${ui.cardGhost} p-8`}>
            <h2 className="text-2xl font-semibold text-gray-900">
              还没有家庭场景主角
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {pageStatusNotice?.text || "先创建宠物，再回来体验家庭场景。"}
            </p>
            <Link
              href="/create-pet"
              className={`mt-6 ${ui.buttonPrimary}`}
            >
              去创建宠物
            </Link>
          </section>
        ) : null}

        {isLoaded && authToken && pet ? (
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <section className={`${ui.cardWarm} p-6`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-amber-700">
                    当前宠物：{pet.petName}
                  </p>
                  {lastStatusSyncedAt ? (
                    <p className="mt-2 text-xs text-gray-500">
                      {buildHomeStatusFreshnessText(lastStatusSyncedAt)}
                    </p>
                  ) : null}
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                    俯视角家庭地图
                  </h2>
                </div>

                {statusDisplayPolicy.showSummaryBadge ? (
                  <div className={`${ui.chip} px-4 py-2`}>
                    {getHomeStatusSummaryText(status, statusViewState)}
                  </div>
                ) : null}
              </div>

              <PetHomeScene
                currentRoom={currentRoom}
                isEditMode={isFurnitureEditMode}
                pets={pets.length > 0 ? pets.map((p) => ({
                  id: p.id,
                  petName: p.petName,
                  petSpecies: p.species,
                  petStatus: petStatuses.get(p.id) ?? null,
                  recentSocialEmotion: normalizeHomeSocialEmotion(
                    petStatuses.get(p.id)?.socialEmotion ?? null
                  ),
                })) : [{
                  id: pet.id,
                  petName: pet.petName,
                  petSpecies: pet.species,
                  petStatus: status,
                  recentSocialEmotion: normalizeHomeSocialEmotion(
                    status?.socialEmotion ?? null
                  ),
                }]}
                placedFurniture={placedFurniture}
                onPlacedFurnitureChange={handleFurnitureDraftChange}
                onEditError={handleFurnitureEditError}
                onAction={(action) => {
                  void handleSceneAction(action);
                }}
              />

              <div className={`${ui.cardSoft} mt-4 bg-white/85 p-3 shadow-sm`}>
                <div className="flex flex-wrap gap-2">
                  {HOME_SCENE_ROOMS.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setCurrentRoom(room.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      room.id === currentRoom
                        ? "bg-stone-900 text-white shadow-sm"
                        : "bg-[#f6ebda] text-[#7b4b22] hover:bg-[#eedec5]"
                    }`}
                  >
                      {room.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SCENE_OBJECT_ENTRIES.map(([action, item]) => (
                  <div
                    key={action}
                    className={`${ui.cardSoft} bg-white/80 p-4 text-sm text-gray-600 shadow-sm`}
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

              {statusDisplayPolicy.showSyncNotice && statusSyncNotice ? (
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
              <section className={`${ui.card} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      场景说明
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      点击宠物会先展开互动菜单，再选择查看状态或直接打开场景内聊天窗口；固定物件则分成两类：立即互动点会直接调用接口，行为目标点只负责解释宠物当前会往哪里移动。
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleFurnitureEditToggle();
                      }}
                      disabled={isFurnitureLayoutSaving}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isFurnitureEditMode
                          ? "bg-stone-900 text-white hover:bg-stone-700"
                          : "border border-[#d7c6b1] bg-[#f6ebda] text-[#7b4b22] hover:bg-[#eedec5]"
                      }`}
                    >
                      {isFurnitureLayoutSaving
                        ? "保存中..."
                        : isFurnitureEditMode
                          ? "退出并保存布置"
                          : "进入布置模式"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePetPanel((currentPanel) =>
                          currentPanel === "status" ? null : "status"
                        )
                      }
                      className={`${ui.buttonOutline} px-4 py-2`}
                    >
                      {isPetPanelOpen ? "收起状态面板" : "打开状态面板"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPetMenuOpen(false);
                        if (isHomeChatOpen) {
                          setActivePetPanel(null);
                          return;
                        }
                        setIsHomeChatLoaded(false);
                        setActivePetPanel("chat");
                      }}
                      className={`${ui.buttonPrimary} px-4 py-2`}
                    >
                      {isHomeChatOpen ? "收起聊天窗口" : `和 ${pet.petName} 聊天`}
                    </button>
                  </div>
                </div>

                <div className={`${ui.cardSoft} mt-4 p-4 text-sm leading-7 text-gray-600`}>
                  <p>
                    房间切换：通过场景下方标签在客厅、卧室、厨房之间切换，当前显示 {currentRoomMeta.label}。
                  </p>
                  <p>
                    行为规则：饥饿优先找食盆，口渴优先找水盆，疲惫优先找床，否则在房间里巡视。
                  </p>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-7 text-gray-600 md:grid-cols-2">
                  <div className={`${ui.cardSoft} p-4`}>
                    <p className="font-medium text-gray-900">立即互动</p>
                    <p className="mt-2">
                      {INSTANT_OBJECT_LABELS}
                      会在点击后马上调用后端接口，属于直接结算当前动作的交互点。
                    </p>
                  </div>
                  <div className={`${ui.cardSoft} p-4`}>
                    <p className="font-medium text-gray-900">行为目标点</p>
                    <p className="mt-2">
                      {TARGET_OBJECT_LABELS}
                      当前只负责表达宠物的移动目标和休息语义，不会立刻写入新的数值结果。
                    </p>
                  </div>
                </div>
              </section>

              {isPetMenuOpen ? (
                <section className={`${ui.card} p-6`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        宠物互动菜单
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        已选中 {pet.petName}。当前先通过菜单决定要查看状态，还是直接展开场景内聊天窗口。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsPetMenuOpen(false)}
                      className={`${ui.buttonOutline} px-4 py-2`}
                    >
                      收起菜单
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {HOME_PET_INTERACTION_MENU_ITEMS.map((item) => (
                      <button
                        key={item.action}
                        type="button"
                        onClick={() => handlePetMenuAction(item.action)}
                        className={`rounded-2xl px-4 py-4 text-left transition ${
                          item.action === "status"
                            ? "border border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100"
                            : "border border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                          <p
                            className={`text-sm font-semibold ${
                              item.action === "status"
                                ? "text-amber-900"
                                : "text-gray-900"
                            }`}
                          >
                            {item.label}
                          </p>
                          <p
                            className={`mt-2 text-sm leading-6 ${
                              item.action === "status"
                                ? "text-amber-800"
                                : "text-gray-600"
                            }`}
                          >
                            {item.description}
                          </p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {isPetPanelOpen ? (
                <PetStatusPanel
                  petId={pet.id}
                  authToken={authToken}
                  status={status}
                  statusViewState={statusViewState}
                  onStatusChange={applyStatusSnapshot}
                />
              ) : isHomeChatOpen ? (
                <section className={`${ui.card} p-6`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        场景内聊天窗口
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        你正在家庭场景里直接和 {pet.petName} 聊天，不需要再跳转到独立页面。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePetPanel(null)}
                      className={`${ui.buttonOutline} px-4 py-2`}
                    >
                      收起聊天窗口
                    </button>
                  </div>

                  {homeChatStatusMessage ? (
                    <div
                      className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                        homeChatStatusMessage.type === "error"
                        ? ui.noticeError
                        : ui.noticeInfo
                      }`}
                    >
                      {homeChatStatusMessage.message}
                    </div>
                  ) : null}

                  <div
                    ref={chatMessagesContainerRef}
                    className={`mt-4 h-[320px] overflow-y-auto ${ui.cardSoft} p-4`}
                  >
                    {isHomeChatLoading ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 text-center text-sm leading-6 text-gray-500">
                        正在读取 {pet.petName} 的聊天记录，请稍等一下。
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 text-center text-sm leading-6 text-gray-500">
                        还没有聊天记录，先和 {pet.petName} 打个招呼吧。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {chatMessages.map((message) => (
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
                                {message.role === "user" ? "你" : pet.petName}
                              </p>
                              <p>{message.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleHomeChatSubmit}
                    className={`mt-4 ${ui.cardSoft} bg-white p-4`}
                  >
                    <label
                      htmlFor="home-scene-chat-message"
                      className="mb-2 block text-sm font-medium text-gray-800"
                    >
                      对 {pet.petName} 说点什么
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        id="home-scene-chat-message"
                        type="text"
                        value={chatInputValue}
                        onChange={(event) => setChatInputValue(event.target.value)}
                        onKeyDown={handleHomeChatInputKeyDown}
                        placeholder="例如：今天想做什么？"
                        disabled={isHomeChatLoading || isHomeChatSending}
                        className={`flex-1 ${ui.input}`}
                      />
                      <button
                        type="submit"
                        disabled={!canSendHomeChatMessage}
                        className={ui.buttonPrimary}
                      >
                        {isHomeChatSending ? "发送中..." : "发送"}
                      </button>
                    </div>
                  </form>
                </section>
              ) : (
                <section className={`${ui.cardGhost} p-6 text-sm leading-7 text-gray-500`}>
                  点击场景里的宠物会先弹出互动菜单；你可以从菜单里选择查看状态，或直接打开场景内聊天窗口。
                </section>
              )}

              <section className={`${ui.card} p-6`}>
                <h2 className="text-xl font-semibold text-gray-900">
                  独立页面入口
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  家庭场景已经支持快捷查看状态和直接聊天，其它能力继续保持独立页面入口。
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/chat"
                    className={ui.buttonPrimary}
                  >
                    去聊天窗口
                  </Link>
                  <Link
                    href="/my-pet"
                    className={ui.buttonSecondary}
                  >
                    查看宠物资料
                  </Link>
                  <Link
                    href="/social"
                    className={ui.buttonOutline}
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
