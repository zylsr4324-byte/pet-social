import type { PetStatus } from "./PetStatusPanel";

export type HomeSceneObjectAction = "feed" | "drink" | "play" | "bed";
export type HomeRoomId = "living" | "bedroom" | "kitchen";

export type TilePoint = {
  tileX: number;
  tileY: number;
};

export type RoomOpening = {
  side: "north" | "south" | "east" | "west";
  center: number;
  size: number;
};

export type RoomConfig = {
  id: HomeRoomId;
  label: string;
  emoji: string;
  floorStyle: "wood" | "carpet" | "tile";
  floorColor: number;
  wallColor: number;
  trimColor: number;
  doors: RoomOpening[];
  windows: RoomOpening[];
  petSpots: TilePoint[];
  idlePoints: TilePoint[];
};

export type HomeSceneObjectMeta = {
  label: string;
  room: HomeRoomId;
  tileX: number;
  tileY: number;
  color: number;
  interactionKind: "instant" | "target";
  badgeLabel: string;
  panelDescription: string;
  fallbackMessage: string;
};

export type HomeSceneBehavior = {
  state:
    | "wandering"
    | "seeking_food"
    | "seeking_water"
    | "seeking_rest"
    | "playing"
    | "grooming"
    | "social"
    | "sleeping";
  target: HomeSceneObjectAction | null;
  label: string;
  summary: string;
};

export type HomeSceneBehaviorContext = {
  hasToy?: boolean;
  hasOtherPets?: boolean;
};

export type HomePetSpriteSpec = {
  speciesLabel: string;
  face: string;
  bodyWidth: number;
  bodyHeight: number;
  earStyle: "pointed" | "floppy" | "long";
  tailStyle: "short" | "curled" | "cotton" | "bushy";
};

export type PetInteractionMenuAction = "status" | "chat";

export type PetInteractionMenuItem = {
  action: PetInteractionMenuAction;
  label: string;
  description: string;
};

export const HOME_SCENE_ROOMS: RoomConfig[] = [
  {
    id: "living",
    label: "客厅",
    emoji: "🛋",
    floorStyle: "wood",
    floorColor: 0xc8956c,
    wallColor: 0xf5f0e8,
    trimColor: 0x8b5e3c,
    doors: [
      {
        side: "east",
        center: 0.52,
        size: 92,
      },
    ],
    windows: [
      {
        side: "south",
        center: 0.34,
        size: 78,
      },
      {
        side: "south",
        center: 0.68,
        size: 78,
      },
    ],
    petSpots: [
      { tileX: 7, tileY: 11 },
      { tileX: 10, tileY: 13 },
      { tileX: 13, tileY: 10 },
    ],
    idlePoints: [
      { tileX: 6, tileY: 8 },
      { tileX: 11, tileY: 7 },
      { tileX: 14, tileY: 12 },
      { tileX: 8, tileY: 14 },
    ],
  },
  {
    id: "bedroom",
    label: "卧室",
    emoji: "🛏",
    floorStyle: "carpet",
    floorColor: 0xf0e8d8,
    wallColor: 0xf5f0e8,
    trimColor: 0xb68f63,
    doors: [
      {
        side: "west",
        center: 0.52,
        size: 92,
      },
      {
        side: "east",
        center: 0.52,
        size: 92,
      },
    ],
    windows: [
      {
        side: "east",
        center: 0.26,
        size: 84,
      },
    ],
    petSpots: [
      { tileX: 7, tileY: 12 },
      { tileX: 10, tileY: 10 },
      { tileX: 13, tileY: 13 },
    ],
    idlePoints: [
      { tileX: 6, tileY: 9 },
      { tileX: 10, tileY: 8 },
      { tileX: 14, tileY: 10 },
      { tileX: 9, tileY: 14 },
    ],
  },
  {
    id: "kitchen",
    label: "厨房",
    emoji: "🍳",
    floorStyle: "tile",
    floorColor: 0xe8e8e8,
    wallColor: 0xf5f0e8,
    trimColor: 0xa5a5a5,
    doors: [
      {
        side: "west",
        center: 0.52,
        size: 92,
      },
    ],
    windows: [
      {
        side: "north",
        center: 0.5,
        size: 84,
      },
    ],
    petSpots: [
      { tileX: 7, tileY: 13 },
      { tileX: 10, tileY: 12 },
      { tileX: 13, tileY: 14 },
    ],
    idlePoints: [
      { tileX: 6, tileY: 9 },
      { tileX: 9, tileY: 7 },
      { tileX: 13, tileY: 8 },
      { tileX: 11, tileY: 13 },
    ],
  },
];

export const HOME_SCENE_OBJECTS: Record<
  HomeSceneObjectAction,
  HomeSceneObjectMeta
> = {
  feed: {
    label: "食盆",
    room: "kitchen",
    tileX: 7,
    tileY: 13,
    color: 0xf59e0b,
    interactionKind: "instant",
    badgeLabel: "立即互动",
    panelDescription: "点击后会马上调用喂食接口，直接结算这次照料动作。",
    fallbackMessage: "已直接触发喂食互动。",
  },
  drink: {
    label: "水盆",
    room: "kitchen",
    tileX: 11,
    tileY: 13,
    color: 0x38bdf8,
    interactionKind: "instant",
    badgeLabel: "立即互动",
    panelDescription: "点击后会马上调用喂水接口，直接更新当前口渴状态。",
    fallbackMessage: "已直接触发喂水互动。",
  },
  play: {
    label: "玩具",
    room: "living",
    tileX: 13,
    tileY: 13,
    color: 0xfb7185,
    interactionKind: "instant",
    badgeLabel: "立即互动",
    panelDescription: "点击后会马上调用玩耍接口，直接结算好感和精力变化。",
    fallbackMessage: "已直接触发玩耍互动。",
  },
  bed: {
    label: "床",
    room: "bedroom",
    tileX: 13,
    tileY: 11,
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

export function getRoomConfig(roomId: HomeRoomId): RoomConfig {
  return HOME_SCENE_ROOMS.find((room) => room.id === roomId) ?? HOME_SCENE_ROOMS[0];
}

export function getRoomIndex(roomId: HomeRoomId) {
  return HOME_SCENE_ROOMS.findIndex((room) => room.id === roomId);
}

export function getHomePetSpriteSpec(species: string): HomePetSpriteSpec {
  switch (species) {
    case "猫":
      return {
        speciesLabel: "猫系轮廓",
        face: "^.^",
        bodyWidth: 36,
        bodyHeight: 36,
        earStyle: "pointed",
        tailStyle: "short",
      };
    case "狗":
      return {
        speciesLabel: "狗系轮廓",
        face: "u.u",
        bodyWidth: 42,
        bodyHeight: 34,
        earStyle: "floppy",
        tailStyle: "curled",
      };
    case "兔子":
      return {
        speciesLabel: "兔系轮廓",
        face: "•ᴗ•",
        bodyWidth: 32,
        bodyHeight: 38,
        earStyle: "long",
        tailStyle: "cotton",
      };
    case "狐狸":
      return {
        speciesLabel: "狐系轮廓",
        face: "^o^",
        bodyWidth: 40,
        bodyHeight: 34,
        earStyle: "pointed",
        tailStyle: "bushy",
      };
    default:
      return {
        speciesLabel: "通用轮廓",
        face: "^.^",
        bodyWidth: 36,
        bodyHeight: 36,
        earStyle: "pointed",
        tailStyle: "short",
      };
  }
}

export function getHomeSceneBehavior(
  status: PetStatus | null,
  context: HomeSceneBehaviorContext = {}
): HomeSceneBehavior {
  if (!status) {
    return {
      state: "wandering",
      target: null,
      label: "正在巡视房间",
      summary: "状态读取中",
    };
  }

  if (status.fullness < 40) {
    return {
      state: "seeking_food",
      target: "feed",
      label: "肚子饿了，正在找食盆",
      summary: "Seeking food：宠物会主动沿路径前往食盆",
    };
  }

  if (status.hydration < 40) {
    return {
      state: "seeking_water",
      target: "drink",
      label: "有点口渴，正在找水盆",
      summary: "Seeking water：宠物会主动沿路径前往水盆",
    };
  }

  if (status.energy < 10) {
    return {
      state: "sleeping",
      target: "bed",
      label: "精力太低，准备上床睡觉",
      summary: "Sleeping：宠物会在床边停下并进入睡眠动画",
    };
  }

  if (status.energy < 30) {
    return {
      state: "seeking_rest",
      target: "bed",
      label: "有点困了，正在找床休息",
      summary: "Seeking rest：宠物会主动回床边恢复体力",
    };
  }

  if (status.cleanliness < 30) {
    return {
      state: "grooming",
      target: null,
      label: "想整理一下毛发",
      summary: "Grooming：宠物会停在原地梳理自己",
    };
  }

  if (status.affection < 50 && context.hasToy) {
    return {
      state: "playing",
      target: "play",
      label: "有点寂寞，想去玩玩具",
      summary: "Playing：宠物会主动去玩具旁边蹦跳",
    };
  }

  if (context.hasOtherPets) {
    return {
      state: "social",
      target: null,
      label: "发现同伴了，想过去打招呼",
      summary: "Social：宠物会走向附近同伴并触发问候动画",
    };
  }

  return {
    state: "wandering",
    target: null,
    label: "状态不错，正在房间里巡视",
    summary: "Wandering：宠物会在房间里沿路径随机游走",
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
