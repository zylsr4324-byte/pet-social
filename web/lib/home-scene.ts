import type { PetStatus } from "./PetStatusPanel";

export type HomeSceneObjectAction = "feed" | "drink" | "play" | "bed";

export type HomeSceneObjectMeta = {
  label: string;
  tileX: number;
  tileY: number;
  color: number;
  interactionKind: "instant" | "target";
  badgeLabel: string;
  panelDescription: string;
  fallbackMessage: string;
};

export type HomeSceneBehavior = {
  state: "idle" | "hungry" | "thirsty" | "tired";
  target: HomeSceneObjectAction;
  label: string;
  summary: string;
};

export type PetInteractionMenuAction = "status" | "chat";

export type PetInteractionMenuItem = {
  action: PetInteractionMenuAction;
  label: string;
  description: string;
};

export const HOME_SCENE_OBJECTS: Record<
  HomeSceneObjectAction,
  HomeSceneObjectMeta
> = {
  feed: {
    label: "食盆",
    tileX: 4,
    tileY: 15,
    color: 0xf59e0b,
    interactionKind: "instant",
    badgeLabel: "立即互动",
    panelDescription: "点击后会马上调用喂食接口，直接结算这次照料动作。",
    fallbackMessage: "已直接触发喂食互动。",
  },
  drink: {
    label: "水盆",
    tileX: 9,
    tileY: 15,
    color: 0x38bdf8,
    interactionKind: "instant",
    badgeLabel: "立即互动",
    panelDescription: "点击后会马上调用喂水接口，直接更新当前口渴状态。",
    fallbackMessage: "已直接触发喂水互动。",
  },
  play: {
    label: "玩具",
    tileX: 14,
    tileY: 6,
    color: 0xfb7185,
    interactionKind: "instant",
    badgeLabel: "立即互动",
    panelDescription: "点击后会马上调用玩耍接口，直接结算好感和精力变化。",
    fallbackMessage: "已直接触发玩耍互动。",
  },
  bed: {
    label: "床",
    tileX: 15,
    tileY: 14,
    color: 0xa78bfa,
    interactionKind: "target",
    badgeLabel: "休息目标",
    panelDescription: "这里只表示宠物疲惫时会回床边休息，当前不会立即写入睡眠数值。",
    fallbackMessage: "床当前只作为休息目标点，不会立即写入数值。",
  },
};

export const HOME_PET_INTERACTION_MENU_ITEMS: PetInteractionMenuItem[] = [
  {
    action: "status",
    label: "查看状态面板",
    description: "打开右侧状态面板，查看当前数值并继续执行照料动作。",
  },
  {
    action: "chat",
    label: "打开聊天窗口",
    description: "直接在家庭场景里展开聊天窗口，不再跳转到独立聊天页面。",
  },
];

export function getHomeSceneBehavior(status: PetStatus | null): HomeSceneBehavior {
  if (!status) {
    return {
      state: "idle",
      target: "feed",
      label: "正在巡视房间",
      summary: "状态读取中",
    };
  }

  if (status.fullness < 55) {
    return {
      state: "hungry",
      target: "feed",
      label: "肚子饿了，去找食盆",
      summary: "Hungry：宠物会主动靠近食盆",
    };
  }

  if (status.hydration < 55) {
    return {
      state: "thirsty",
      target: "drink",
      label: "有点口渴，去找水盆",
      summary: "Thirsty：宠物会主动靠近水盆",
    };
  }

  if (status.energy < 45) {
    return {
      state: "tired",
      target: "bed",
      label: "有点困了，去床边休息",
      summary: "Tired：宠物会回到床边休息",
    };
  }

  return {
    state: "idle",
    target: "play",
    label: "状态不错，四处溜达",
    summary: "Idle：宠物会在房间里随意巡视",
  };
}

export function buildHomeSceneActionMessage(
  action: HomeSceneObjectAction,
  detail?: string | null
) {
  const normalizedDetail = detail?.trim();
  if (normalizedDetail) {
    return normalizedDetail;
  }

  return HOME_SCENE_OBJECTS[action].fallbackMessage;
}
