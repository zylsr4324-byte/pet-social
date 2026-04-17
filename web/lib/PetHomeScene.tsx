"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type * as PhaserType from "phaser";

import {
  getHomePetSpriteSpec,
  getHomeSceneBehavior,
  getRoomConfig,
  getRoomIndex,
  HOME_SCENE_OBJECTS,
  type HomeSocialEmotion,
  type HomeSceneBehavior,
  type HomeRoomId,
  type HomeSceneObjectAction,
  type HomeSceneObjectMeta,
  type RoomConfig,
  type TilePoint,
} from "./home-scene";
import type { PlacedFurnitureResponse } from "./furniture";
import type { PetStatus } from "./PetStatusPanel";

export type SceneAction = "pet" | HomeSceneObjectAction;

export type PetSceneData = {
  id: number;
  petName: string;
  petSpecies: string;
  petStatus: PetStatus | null;
  recentSocialEmotion?: HomeSocialEmotion | null;
};

type PetHomeSceneProps = {
  pets: PetSceneData[];
  currentRoom: HomeRoomId;
  isEditMode?: boolean;
  onAction: (action: SceneAction, petId: number) => void;
  placedFurniture?: PlacedFurnitureResponse[];
  onPlacedFurnitureChange?: (nextFurniture: PlacedFurnitureResponse[]) => void;
  onEditError?: (message: string) => void;
};

type SceneApi = {
  refresh: () => void;
  setRoom: (roomId: HomeRoomId) => void;
  syncFurniture: () => void;
};

type SceneRefs = {
  petsRef: MutableRefObject<PetSceneData[]>;
  actionRef: MutableRefObject<(action: SceneAction, petId: number) => void>;
  currentRoomRef: MutableRefObject<HomeRoomId>;
  editModeRef: MutableRefObject<boolean>;
  furnitureRef: MutableRefObject<PlacedFurnitureResponse[]>;
  furnitureChangeRef: MutableRefObject<
    ((nextFurniture: PlacedFurnitureResponse[]) => void) | undefined
  >;
  editErrorRef: MutableRefObject<((message: string) => void) | undefined>;
  apiRef: MutableRefObject<SceneApi | null>;
};

type FurnitureVisualKey =
  | "feed"
  | "drink"
  | "play"
  | "bed"
  | "sofa"
  | "catTree"
  | "table"
  | "plant"
  | "generic";

type RoomLayer = {
  container: PhaserType.GameObjects.Container;
  furnitureLayer: PhaserType.GameObjects.Container;
};

type FurnitureNode = {
  container: PhaserType.GameObjects.Container;
  caption: PhaserType.GameObjects.Text;
  hint: PhaserType.GameObjects.Text | null;
  width: number;
  height: number;
};

type PetSprite = {
  container: PhaserType.GameObjects.Container;
  tintParts: PhaserType.GameObjects.Shape[];
  label: PhaserType.GameObjects.Text;
  mouth: PhaserType.GameObjects.Text;
  slotIndex: number;
  idleIndex: number;
  currentTile: TilePoint;
  isBusy: boolean;
  activeText: PhaserType.GameObjects.Text | null;
};

type ObstacleFootprint = {
  key: string;
  roomId: HomeRoomId;
  tile: TilePoint;
  widthTiles: number;
  heightTiles: number;
  action: HomeSceneObjectAction | null;
  category: string | null;
};

type TileRect = {
  startTileX: number;
  endTileX: number;
  startTileY: number;
  endTileY: number;
};

const GRID_SIZE = 20;
const TILE_SIZE = 28;
const SCENE_WIDTH = GRID_SIZE * TILE_SIZE;
const SCENE_HEIGHT = GRID_SIZE * TILE_SIZE;
const WALL_THICKNESS = 16;
const WINDOW_THICKNESS = 12;
const ROOM_TRANSITION_MS = 300;
const ROOM_GLASS_COLOR = 0xbfe3ff;
const ROOM_SHADOW_COLOR = 0x8c755b;
const FLOOR_TEXTURE_KEYS = {
  wood: "home-floor-wood",
  carpet: "home-floor-carpet",
  tile: "home-floor-tile",
} as const satisfies Record<RoomConfig["floorStyle"], string>;
const FURNITURE_TEXTURE_KEYS = {
  feed: "home-furniture-feed",
  drink: "home-furniture-drink",
  play: "home-furniture-play",
  bed: "home-furniture-bed",
  sofa: "home-furniture-sofa",
  catTree: "home-furniture-cat-tree",
  table: "home-furniture-table",
  plant: "home-furniture-plant",
  generic: "home-furniture-generic",
} as const satisfies Record<FurnitureVisualKey, string>;
const WALL_TEXTURE_KEY = "home-wall-surface";

function toTileKey(tile: TilePoint) {
  return `${tile.tileX}:${tile.tileY}`;
}

function parseTileKey(key: string): TilePoint {
  const [tileX, tileY] = key.split(":").map(Number);
  return { tileX, tileY };
}

function toWorld(tileX: number, tileY: number) {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

function getPetTint(status: PetStatus | null) {
  if (!status) {
    return 0xfbbf24;
  }

  switch (status.mood) {
    case "happy":
      return 0x34d399;
    case "sad":
      return 0x60a5fa;
    case "uncomfortable":
      return 0xf87171;
    default:
      return 0xfbbf24;
  }
}

function getRoomPetPoint(roomId: HomeRoomId, slotIndex: number) {
  const room = getRoomConfig(roomId);
  return room.petSpots[slotIndex % room.petSpots.length];
}

function isInteriorTile(tile: TilePoint) {
  return (
    tile.tileX >= 1 &&
    tile.tileX <= GRID_SIZE - 2 &&
    tile.tileY >= 1 &&
    tile.tileY <= GRID_SIZE - 2
  );
}

function getNextIdlePoint(roomId: HomeRoomId, idleIndex: number) {
  const room = getRoomConfig(roomId);
  return room.idlePoints[idleIndex % room.idlePoints.length];
}

function getFootprintRect(
  tile: TilePoint,
  widthTiles: number,
  heightTiles: number
): TileRect {
  const startTileX = tile.tileX - Math.floor((widthTiles - 1) / 2);
  const startTileY = tile.tileY - Math.floor((heightTiles - 1) / 2);

  return {
    startTileX,
    endTileX: startTileX + widthTiles - 1,
    startTileY,
    endTileY: startTileY + heightTiles - 1,
  };
}

function getTilesInRect(rect: TileRect) {
  const tiles: TilePoint[] = [];

  for (let tileX = rect.startTileX; tileX <= rect.endTileX; tileX += 1) {
    for (let tileY = rect.startTileY; tileY <= rect.endTileY; tileY += 1) {
      tiles.push({ tileX, tileY });
    }
  }

  return tiles;
}

function getAdjacentTilesForRect(rect: TileRect) {
  const tiles = new Map<string, TilePoint>();

  for (let tileX = rect.startTileX - 1; tileX <= rect.endTileX + 1; tileX += 1) {
    [
      { tileX, tileY: rect.startTileY - 1 },
      { tileX, tileY: rect.endTileY + 1 },
    ].forEach((tile) => {
      if (isInteriorTile(tile)) {
        tiles.set(toTileKey(tile), tile);
      }
    });
  }

  for (let tileY = rect.startTileY; tileY <= rect.endTileY; tileY += 1) {
    [
      { tileX: rect.startTileX - 1, tileY },
      { tileX: rect.endTileX + 1, tileY },
    ].forEach((tile) => {
      if (isInteriorTile(tile)) {
        tiles.set(toTileKey(tile), tile);
      }
    });
  }

  return [...tiles.values()];
}

function getManhattanDistance(from: TilePoint, to: TilePoint) {
  return Math.abs(from.tileX - to.tileX) + Math.abs(from.tileY - to.tileY);
}

function normalizeBehaviorAction(action: string | null): HomeSceneObjectAction | null {
  if (action === "feed" || action === "drink" || action === "play" || action === "bed") {
    return action;
  }
  return null;
}

function getDefaultObjectTileSize(action: HomeSceneObjectAction) {
  if (action === "bed") {
    return { widthTiles: 4, heightTiles: 3 };
  }
  return { widthTiles: 2, heightTiles: 2 };
}

function findTilePath(
  start: TilePoint,
  goal: TilePoint,
  blockedTiles: Set<string>
): TilePoint[] | null {
  if (toTileKey(start) === toTileKey(goal)) {
    return [];
  }

  const startKey = toTileKey(start);
  const goalKey = toTileKey(goal);
  const openTiles = new Map<string, TilePoint>([[startKey, start]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([
    [startKey, getManhattanDistance(start, goal)],
  ]);

  while (openTiles.size > 0) {
    const currentEntry = [...openTiles.entries()].reduce((best, entry) => {
      if (!best) {
        return entry;
      }
      return (fScore.get(entry[0]) ?? Number.POSITIVE_INFINITY) <
        (fScore.get(best[0]) ?? Number.POSITIVE_INFINITY)
        ? entry
        : best;
    }, null as [string, TilePoint] | null);

    if (!currentEntry) {
      break;
    }

    const [currentKey, currentTile] = currentEntry;
    if (currentKey === goalKey) {
      const path: TilePoint[] = [goal];
      let walkKey = currentKey;

      while (walkKey !== startKey) {
        const parentKey = cameFrom.get(walkKey);
        if (!parentKey) {
          return null;
        }
        walkKey = parentKey;
        if (walkKey !== startKey) {
          path.unshift(parseTileKey(walkKey));
        }
      }

      return path;
    }

    openTiles.delete(currentKey);

    [
      { tileX: currentTile.tileX + 1, tileY: currentTile.tileY },
      { tileX: currentTile.tileX - 1, tileY: currentTile.tileY },
      { tileX: currentTile.tileX, tileY: currentTile.tileY + 1 },
      { tileX: currentTile.tileX, tileY: currentTile.tileY - 1 },
    ].forEach((neighbor) => {
      const neighborKey = toTileKey(neighbor);

      if (
        !isInteriorTile(neighbor) ||
        blockedTiles.has(neighborKey) ||
        neighborKey === currentKey
      ) {
        return;
      }

      const nextScore = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
      if (nextScore >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        return;
      }

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, nextScore);
      fScore.set(neighborKey, nextScore + getManhattanDistance(neighbor, goal));
      openTiles.set(neighborKey, neighbor);
    });
  }

  return null;
}

function findBestPath(
  start: TilePoint,
  candidates: TilePoint[],
  blockedTiles: Set<string>
): TilePoint[] | null {
  const uniqueCandidates = new Map<string, TilePoint>();
  candidates.forEach((candidate) => {
    if (isInteriorTile(candidate) && !blockedTiles.has(toTileKey(candidate))) {
      uniqueCandidates.set(toTileKey(candidate), candidate);
    }
  });

  let bestPath: TilePoint[] | null = null;

  uniqueCandidates.forEach((candidate) => {
    const path = findTilePath(start, candidate, blockedTiles);
    if (!path) {
      return;
    }

    if (
      !bestPath ||
      path.length < bestPath.length ||
      (path.length === bestPath.length &&
        getManhattanDistance(start, candidate) <
          getManhattanDistance(start, bestPath[bestPath.length - 1] ?? start))
    ) {
      bestPath = path;
    }
  });

  return bestPath;
}

function resolvePlacedFurnitureRoom(item: PlacedFurnitureResponse): HomeRoomId {
  if (item.room) {
    return item.room;
  }
  const action = item.template.interaction_action;
  if (action === "feed" || action === "drink") {
    return "kitchen";
  }
  if (action === "bed" || item.template.category === "bed") {
    return "bedroom";
  }
  if (action === "play") {
    return "living";
  }
  if (item.template.sprite_key === "sofa") {
    return "living";
  }
  return "living";
}

function normalizeRotation(
  rotation: number | null | undefined
): PlacedFurnitureResponse["rotation"] {
  if (rotation === 90 || rotation === 180 || rotation === 270) {
    return rotation;
  }
  return 0;
}

function getRotatedTileSize(item: PlacedFurnitureResponse) {
  const rotation = normalizeRotation(item.rotation);
  if (rotation === 90 || rotation === 270) {
    return {
      widthTiles: item.template.height,
      heightTiles: item.template.width,
    };
  }
  return {
    widthTiles: item.template.width,
    heightTiles: item.template.height,
  };
}

function getFurnitureBounds(
  item: Pick<PlacedFurnitureResponse, "tile_x" | "tile_y" | "template" | "rotation">
) {
  const { widthTiles, heightTiles } = getRotatedTileSize(item as PlacedFurnitureResponse);
  const center = toWorld(item.tile_x, item.tile_y);
  const width = widthTiles * TILE_SIZE;
  const height = heightTiles * TILE_SIZE;
  return {
    width,
    height,
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
  };
}

function isFurnitureInsideRoom(
  item: Pick<PlacedFurnitureResponse, "tile_x" | "tile_y" | "template" | "rotation">
) {
  const bounds = getFurnitureBounds(item);
  return (
    bounds.left >= WALL_THICKNESS &&
    bounds.right <= SCENE_WIDTH - WALL_THICKNESS &&
    bounds.top >= WALL_THICKNESS &&
    bounds.bottom <= SCENE_HEIGHT - WALL_THICKNESS
  );
}

function furnitureOverlaps(
  target: Pick<
    PlacedFurnitureResponse,
    "id" | "room" | "tile_x" | "tile_y" | "template" | "rotation"
  >,
  items: PlacedFurnitureResponse[]
) {
  const targetBounds = getFurnitureBounds(target);
  return items.some((item) => {
    if (item.id === target.id || resolvePlacedFurnitureRoom(item) !== target.room) {
      return false;
    }

    const itemBounds = getFurnitureBounds(item);
    return (
      targetBounds.left < itemBounds.right &&
      targetBounds.right > itemBounds.left &&
      targetBounds.top < itemBounds.bottom &&
      targetBounds.bottom > itemBounds.top
    );
  });
}

function snapWorldToTile(position: number) {
  return Math.round((position - TILE_SIZE / 2) / TILE_SIZE);
}

function getFurnitureVisualKey(
  spriteKey: string | null | undefined,
  action: HomeSceneObjectAction | null | undefined
): FurnitureVisualKey {
  if (action === "feed") {
    return "feed";
  }
  if (action === "drink") {
    return "drink";
  }
  if (action === "play") {
    return "play";
  }
  if (action === "bed") {
    return "bed";
  }

  switch (spriteKey) {
    case "pet_bed":
      return "bed";
    case "sofa":
      return "sofa";
    case "cat_tree":
      return "catTree";
    case "table":
      return "table";
    case "plant":
      return "plant";
    default:
      return "generic";
  }
}

function generateTextureIfMissing(
  scene: PhaserType.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: PhaserType.GameObjects.Graphics) => void
) {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.add.graphics();
  graphics.setVisible(false);
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function ensureHomeSceneTextures(scene: PhaserType.Scene) {
  generateTextureIfMissing(scene, FLOOR_TEXTURE_KEYS.wood, 96, 96, (graphics) => {
    graphics.fillStyle(0xc79268, 1);
    graphics.fillRect(0, 0, 96, 96);

    for (let y = 0; y < 96; y += 24) {
      graphics.fillStyle(y % 48 === 0 ? 0xd8a57b : 0xb77d56, 0.9);
      graphics.fillRect(0, y, 96, 12);
    }

    graphics.lineStyle(2, 0x8d5738, 0.36);
    [32, 64].forEach((x) => {
      graphics.lineBetween(x, 0, x, 96);
    });

    graphics.lineStyle(1, 0xffffff, 0.14);
    for (let y = 6; y < 96; y += 24) {
      graphics.lineBetween(0, y, 96, y);
    }

    graphics.fillStyle(0x875536, 0.18);
    graphics.fillEllipse(18, 18, 12, 8);
    graphics.fillEllipse(68, 58, 16, 9);
    graphics.fillEllipse(42, 82, 10, 6);
  });

  generateTextureIfMissing(scene, FLOOR_TEXTURE_KEYS.carpet, 96, 96, (graphics) => {
    graphics.fillStyle(0xe8dece, 1);
    graphics.fillRect(0, 0, 96, 96);

    graphics.lineStyle(1, 0xffffff, 0.1);
    for (let x = 0; x <= 96; x += 10) {
      graphics.lineBetween(x, 0, Math.max(0, x - 18), 96);
    }

    graphics.lineStyle(1, 0xd4c3ad, 0.18);
    for (let x = -12; x <= 96; x += 10) {
      graphics.lineBetween(x, 0, Math.min(96, x + 18), 96);
    }

    for (let y = 8; y < 96; y += 24) {
      graphics.fillStyle(0xf7efe4, 0.08);
      graphics.fillRect(0, y, 96, 8);
    }
  });

  generateTextureIfMissing(scene, FLOOR_TEXTURE_KEYS.tile, 96, 96, (graphics) => {
    graphics.fillStyle(0xd2cbc2, 1);
    graphics.fillRect(0, 0, 96, 96);

    for (let tileX = 0; tileX < 3; tileX += 1) {
      for (let tileY = 0; tileY < 3; tileY += 1) {
        const x = tileX * 32 + 2;
        const y = tileY * 32 + 2;
        graphics.fillStyle((tileX + tileY) % 2 === 0 ? 0xf0ebe4 : 0xe1dad2, 1);
        graphics.fillRoundedRect(x, y, 28, 28, 6);
        graphics.fillStyle(0xffffff, 0.1);
        graphics.fillRoundedRect(x + 4, y + 4, 10, 4, 3);
      }
    }

    graphics.lineStyle(4, 0xc7c0b7, 1);
    for (let x = 0; x <= 96; x += 32) {
      graphics.lineBetween(x, 0, x, 96);
    }
    for (let y = 0; y <= 96; y += 32) {
      graphics.lineBetween(0, y, 96, y);
    }
  });

  generateTextureIfMissing(scene, WALL_TEXTURE_KEY, 80, 80, (graphics) => {
    graphics.fillStyle(0xfaf4eb, 1);
    graphics.fillRect(0, 0, 80, 80);

    graphics.lineStyle(1, 0xe4d9c8, 0.18);
    for (let x = 12; x < 80; x += 16) {
      graphics.lineBetween(x, 0, x, 80);
    }

    graphics.fillStyle(0xffffff, 0.1);
    for (let y = 10; y < 80; y += 24) {
      graphics.fillRect(0, y, 80, 8);
    }

    graphics.fillStyle(0xe7dbc9, 0.12);
    graphics.fillCircle(18, 18, 5);
    graphics.fillCircle(60, 48, 6);
    graphics.fillCircle(26, 66, 4);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.feed, 96, 96, (graphics) => {
    graphics.fillStyle(0x000000, 0.16);
    graphics.fillEllipse(48, 66, 54, 14);
    graphics.fillStyle(0xe9cbad, 1);
    graphics.fillEllipse(48, 50, 64, 28);
    graphics.fillStyle(0xc6813e, 1);
    graphics.fillEllipse(48, 50, 52, 18);
    graphics.fillStyle(0xf59e0b, 1);
    graphics.fillEllipse(48, 47, 38, 11);
    graphics.fillStyle(0xfcd34d, 0.9);
    graphics.fillCircle(38, 46, 4);
    graphics.fillCircle(49, 49, 3);
    graphics.fillCircle(57, 44, 4);
    graphics.lineStyle(3, 0x8f5b2d, 0.7);
    graphics.strokeEllipse(48, 50, 64, 28);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.drink, 96, 96, (graphics) => {
    graphics.fillStyle(0x000000, 0.14);
    graphics.fillEllipse(48, 66, 54, 14);
    graphics.fillStyle(0xe7eef7, 1);
    graphics.fillEllipse(48, 50, 64, 28);
    graphics.fillStyle(0x5b9ed6, 1);
    graphics.fillEllipse(48, 50, 52, 18);
    graphics.fillStyle(0x8ad7ff, 0.72);
    graphics.fillEllipse(48, 46, 38, 9);
    graphics.fillStyle(0xffffff, 0.4);
    graphics.fillEllipse(39, 45, 10, 4);
    graphics.lineStyle(3, 0x507da6, 0.72);
    graphics.strokeEllipse(48, 50, 64, 28);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.play, 96, 96, (graphics) => {
    graphics.fillStyle(0x000000, 0.12);
    graphics.fillEllipse(48, 70, 40, 12);
    graphics.lineStyle(3, 0xc68b26, 0.7);
    graphics.lineBetween(18, 76, 40, 58);
    graphics.fillStyle(0xfb7185, 1);
    graphics.fillCircle(48, 50, 24);
    graphics.lineStyle(4, 0xffffff, 0.88);
    graphics.lineBetween(31, 67, 65, 33);
    graphics.lineStyle(3, 0xd94767, 0.84);
    graphics.strokeCircle(48, 50, 24);
    graphics.fillStyle(0xfde68a, 1);
    graphics.fillCircle(63, 35, 9);
    graphics.fillStyle(0xffffff, 0.28);
    graphics.fillCircle(40, 41, 7);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.bed, 160, 120, (graphics) => {
    graphics.fillStyle(0x000000, 0.16);
    graphics.fillEllipse(80, 104, 118, 18);
    graphics.fillStyle(0x8d6ad8, 1);
    graphics.fillRoundedRect(12, 18, 136, 82, 20);
    graphics.fillStyle(0xb89af7, 1);
    graphics.fillRoundedRect(22, 28, 116, 64, 16);
    graphics.fillStyle(0xf8f6ff, 1);
    graphics.fillRoundedRect(28, 34, 46, 22, 12);
    graphics.fillRoundedRect(86, 34, 46, 22, 12);
    graphics.fillStyle(0xe7ddff, 1);
    graphics.fillRoundedRect(26, 58, 108, 26, 12);
    graphics.fillStyle(0xd5c4ff, 0.85);
    graphics.fillRoundedRect(26, 72, 108, 12, 10);
    graphics.fillStyle(0x6f4bc5, 0.72);
    graphics.fillRect(12, 18, 136, 10);
    graphics.lineStyle(4, 0x6d4bb5, 0.78);
    graphics.strokeRoundedRect(12, 18, 136, 82, 20);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.sofa, 160, 112, (graphics) => {
    graphics.fillStyle(0x000000, 0.14);
    graphics.fillEllipse(80, 96, 112, 18);
    graphics.fillStyle(0x8a5838, 1);
    graphics.fillRoundedRect(18, 46, 124, 36, 18);
    graphics.fillRoundedRect(8, 30, 28, 58, 16);
    graphics.fillRoundedRect(124, 30, 28, 58, 16);
    graphics.fillStyle(0xa66d45, 1);
    graphics.fillRoundedRect(24, 18, 112, 34, 18);
    graphics.fillStyle(0xc58a63, 0.95);
    graphics.fillRoundedRect(28, 28, 48, 30, 14);
    graphics.fillRoundedRect(84, 28, 48, 30, 14);
    graphics.fillStyle(0xe4b48b, 0.28);
    graphics.fillRoundedRect(26, 22, 108, 8, 8);
    graphics.lineStyle(3, 0x6f442b, 0.72);
    graphics.strokeRoundedRect(18, 46, 124, 36, 18);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.catTree, 120, 160, (graphics) => {
    graphics.fillStyle(0x000000, 0.14);
    graphics.fillEllipse(60, 146, 82, 16);
    graphics.fillStyle(0xb58a63, 1);
    graphics.fillRect(32, 62, 16, 72);
    graphics.fillRect(72, 44, 16, 90);
    graphics.fillStyle(0xd6b08b, 1);
    graphics.fillRoundedRect(14, 120, 92, 18, 10);
    graphics.fillRoundedRect(18, 56, 70, 16, 9);
    graphics.fillRoundedRect(52, 28, 48, 14, 8);
    graphics.fillStyle(0x46a758, 0.2);
    graphics.fillCircle(92, 44, 10);
    graphics.lineStyle(3, 0x9a734f, 0.76);
    graphics.strokeRoundedRect(14, 120, 92, 18, 10);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.table, 120, 120, (graphics) => {
    graphics.fillStyle(0x000000, 0.14);
    graphics.fillEllipse(60, 104, 78, 14);
    graphics.fillStyle(0x9d6d45, 1);
    graphics.fillRoundedRect(12, 22, 96, 26, 12);
    graphics.fillStyle(0xb68257, 1);
    graphics.fillRoundedRect(18, 18, 84, 12, 8);
    graphics.fillStyle(0x8c5d38, 1);
    graphics.fillRect(24, 44, 10, 44);
    graphics.fillRect(86, 44, 10, 44);
    graphics.fillRect(24, 62, 10, 24);
    graphics.fillRect(86, 62, 10, 24);
    graphics.lineStyle(3, 0x764a2d, 0.76);
    graphics.strokeRoundedRect(12, 22, 96, 26, 12);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.plant, 96, 120, (graphics) => {
    graphics.fillStyle(0x000000, 0.14);
    graphics.fillEllipse(48, 108, 44, 12);
    graphics.fillStyle(0xb26a3c, 1);
    graphics.fillRoundedRect(28, 72, 40, 28, 10);
    graphics.fillStyle(0xd1814a, 0.48);
    graphics.fillRoundedRect(34, 76, 28, 8, 6);
    graphics.fillStyle(0x459b52, 1);
    graphics.fillEllipse(34, 58, 20, 40);
    graphics.fillEllipse(62, 52, 22, 44);
    graphics.fillEllipse(48, 34, 24, 52);
    graphics.fillStyle(0x78ca84, 0.28);
    graphics.fillEllipse(41, 42, 10, 22);
    graphics.fillEllipse(57, 40, 10, 22);
  });

  generateTextureIfMissing(scene, FURNITURE_TEXTURE_KEYS.generic, 120, 96, (graphics) => {
    graphics.fillStyle(0x000000, 0.12);
    graphics.fillEllipse(60, 84, 74, 12);
    graphics.fillStyle(0xe5d9c9, 1);
    graphics.fillRoundedRect(16, 18, 88, 52, 12);
    graphics.fillStyle(0xf3eadf, 0.56);
    graphics.fillRoundedRect(22, 24, 76, 14, 8);
    graphics.lineStyle(3, 0xb79d86, 0.88);
    graphics.strokeRoundedRect(16, 18, 88, 52, 12);
    graphics.lineBetween(60, 18, 60, 70);
    graphics.lineBetween(16, 44, 104, 44);
  });
}

function getFurnitureVisualBounds(
  visualKey: FurnitureVisualKey,
  widthPx: number,
  heightPx: number
) {
  const { width, height } = buildVisualSize(widthPx, heightPx);

  switch (visualKey) {
    case "feed":
    case "drink":
    case "play": {
      const size = Math.min(width, height);
      return { width: size, height: size };
    }
    case "plant":
      return {
        width: Math.max(width, 52),
        height: Math.max(height + 8, 60),
      };
    default:
      return { width, height };
  }
}

function drawFloorPattern(
  scene: PhaserType.Scene,
  target: PhaserType.GameObjects.Container,
  room: RoomConfig
) {
  const floor = scene.add.tileSprite(
    WALL_THICKNESS,
    WALL_THICKNESS,
    SCENE_WIDTH - WALL_THICKNESS * 2,
    SCENE_HEIGHT - WALL_THICKNESS * 2,
    FLOOR_TEXTURE_KEYS[room.floorStyle]
  );
  floor.setOrigin(0);
  target.add(floor);

  const floorShade = scene.add.graphics();
  floorShade.fillStyle(0xffffff, 0.08);
  floorShade.fillRoundedRect(
    WALL_THICKNESS + 10,
    WALL_THICKNESS + 10,
    SCENE_WIDTH - WALL_THICKNESS * 2 - 20,
    34,
    14
  );
  floorShade.fillStyle(0x000000, 0.08);
  floorShade.fillRoundedRect(
    WALL_THICKNESS + 12,
    SCENE_HEIGHT - WALL_THICKNESS - 30,
    SCENE_WIDTH - WALL_THICKNESS * 2 - 24,
    14,
    8
  );
  target.add(floorShade);

  room.windows.forEach((windowMeta) => {
    const opening = getOpeningRect(windowMeta);
    const width =
      windowMeta.side === "north" || windowMeta.side === "south"
        ? opening.width * 1.3
        : 86;
    const height =
      windowMeta.side === "north" || windowMeta.side === "south"
        ? 112
        : opening.height * 1.45;
    const offsetX =
      windowMeta.side === "west" ? 42 : windowMeta.side === "east" ? -42 : 0;
    const offsetY =
      windowMeta.side === "north" ? 42 : windowMeta.side === "south" ? -42 : 0;
    const light = scene.add.ellipse(
      opening.x + opening.width / 2 + offsetX,
      opening.y + opening.height / 2 + offsetY,
      width,
      height,
      0xfff7d6,
      0.16
    );
    light.setAngle(
      windowMeta.side === "west" || windowMeta.side === "east" ? 90 : 0
    );
    target.add(light);
  });
}

function getOpeningRect(opening: RoomConfig["doors"][number]) {
  const maxWidth = SCENE_WIDTH - WALL_THICKNESS * 2;
  const maxHeight = SCENE_HEIGHT - WALL_THICKNESS * 2;

  if (opening.side === "north" || opening.side === "south") {
    const x = WALL_THICKNESS + maxWidth * opening.center - opening.size / 2;
    return {
      x,
      y: opening.side === "north" ? 0 : SCENE_HEIGHT - WALL_THICKNESS,
      width: opening.size,
      height: WALL_THICKNESS,
    };
  }

  const y = WALL_THICKNESS + maxHeight * opening.center - opening.size / 2;
  return {
    x: opening.side === "west" ? 0 : SCENE_WIDTH - WALL_THICKNESS,
    y,
    width: WALL_THICKNESS,
    height: opening.size,
  };
}

function drawWalls(
  scene: PhaserType.Scene,
  target: PhaserType.GameObjects.Container,
  room: RoomConfig
) {
  [
    scene.add.tileSprite(0, 0, SCENE_WIDTH, WALL_THICKNESS, WALL_TEXTURE_KEY),
    scene.add.tileSprite(
      0,
      SCENE_HEIGHT - WALL_THICKNESS,
      SCENE_WIDTH,
      WALL_THICKNESS,
      WALL_TEXTURE_KEY
    ),
    scene.add.tileSprite(0, 0, WALL_THICKNESS, SCENE_HEIGHT, WALL_TEXTURE_KEY),
    scene.add.tileSprite(
      SCENE_WIDTH - WALL_THICKNESS,
      0,
      WALL_THICKNESS,
      SCENE_HEIGHT,
      WALL_TEXTURE_KEY
    ),
  ].forEach((wallPiece) => {
    wallPiece.setOrigin(0);
    wallPiece.setTint(room.wallColor);
    target.add(wallPiece);
  });

  room.doors.forEach((door) => {
    const opening = getOpeningRect(door);
    const openingFill = scene.add.rectangle(
      opening.x,
      opening.y,
      opening.width,
      opening.height,
      room.floorColor,
      1
    );
    openingFill.setOrigin(0);
    target.add(openingFill);
  });

  const trim = scene.add.graphics();
  trim.fillStyle(room.trimColor, 0.5);
  trim.fillRect(
    WALL_THICKNESS,
    WALL_THICKNESS,
    SCENE_WIDTH - WALL_THICKNESS * 2,
    5
  );
  trim.fillRect(
    WALL_THICKNESS,
    SCENE_HEIGHT - WALL_THICKNESS - 5,
    SCENE_WIDTH - WALL_THICKNESS * 2,
    5
  );
  trim.fillRect(
    WALL_THICKNESS,
    WALL_THICKNESS,
    5,
    SCENE_HEIGHT - WALL_THICKNESS * 2
  );
  trim.fillRect(
    SCENE_WIDTH - WALL_THICKNESS - 5,
    WALL_THICKNESS,
    5,
    SCENE_HEIGHT - WALL_THICKNESS * 2
  );
  trim.lineStyle(2, ROOM_SHADOW_COLOR, 0.28);
  trim.strokeRect(
    WALL_THICKNESS / 2,
    WALL_THICKNESS / 2,
    SCENE_WIDTH - WALL_THICKNESS,
    SCENE_HEIGHT - WALL_THICKNESS
  );
  target.add(trim);

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.06);
  shadow.fillRect(
    WALL_THICKNESS,
    WALL_THICKNESS,
    SCENE_WIDTH - WALL_THICKNESS * 2,
    10
  );
  shadow.fillRect(
    WALL_THICKNESS,
    WALL_THICKNESS,
    10,
    SCENE_HEIGHT - WALL_THICKNESS * 2
  );
  target.add(shadow);
}

function drawDoors(
  scene: PhaserType.Scene,
  target: PhaserType.GameObjects.Container,
  room: RoomConfig
) {
  room.doors.forEach((door) => {
    const opening = getOpeningRect(door);
    const threshold = scene.add.graphics();
    threshold.fillStyle(0x8c684e, 0.26);

    if (door.side === "north" || door.side === "south") {
      threshold.fillRoundedRect(
        opening.x + 6,
        door.side === "north"
          ? WALL_THICKNESS + 2
          : SCENE_HEIGHT - WALL_THICKNESS - 8,
        opening.width - 12,
        6,
        3
      );
    } else {
      threshold.fillRoundedRect(
        door.side === "west" ? WALL_THICKNESS + 2 : SCENE_WIDTH - WALL_THICKNESS - 8,
        opening.y + 6,
        6,
        opening.height - 12,
        3
      );
    }
    target.add(threshold);

    const frame = scene.add.graphics();
    frame.lineStyle(3, room.trimColor, 0.8);

    if (door.side === "north" || door.side === "south") {
      frame.strokeRect(
        opening.x,
        door.side === "north" ? WALL_THICKNESS - 2 : SCENE_HEIGHT - WALL_THICKNESS - 2,
        opening.width,
        4
      );
      frame.lineBetween(opening.x, opening.y, opening.x, opening.y + opening.height);
      frame.lineBetween(
        opening.x + opening.width,
        opening.y,
        opening.x + opening.width,
        opening.y + opening.height
      );
    } else {
      frame.strokeRect(
        door.side === "west" ? WALL_THICKNESS - 2 : SCENE_WIDTH - WALL_THICKNESS - 2,
        opening.y,
        4,
        opening.height
      );
      frame.lineBetween(opening.x, opening.y, opening.x + opening.width, opening.y);
      frame.lineBetween(
        opening.x,
        opening.y + opening.height,
        opening.x + opening.width,
        opening.y + opening.height
      );
    }

    target.add(frame);
  });
}

function drawWindows(
  scene: PhaserType.Scene,
  target: PhaserType.GameObjects.Container,
  room: RoomConfig
) {
  room.windows.forEach((windowMeta) => {
    const opening = getOpeningRect(windowMeta);
    const windowShape = scene.add.graphics();
    windowShape.fillStyle(ROOM_GLASS_COLOR, 0.7);
    windowShape.lineStyle(2, 0xffffff, 0.9);

    if (windowMeta.side === "north" || windowMeta.side === "south") {
      const y =
        windowMeta.side === "north"
          ? WALL_THICKNESS - WINDOW_THICKNESS / 2
          : SCENE_HEIGHT - WALL_THICKNESS - WINDOW_THICKNESS / 2;
      windowShape.fillRoundedRect(opening.x, y, opening.width, WINDOW_THICKNESS, 5);
      windowShape.strokeRoundedRect(opening.x, y, opening.width, WINDOW_THICKNESS, 5);
      windowShape.lineBetween(
        opening.x + opening.width / 2,
        y,
        opening.x + opening.width / 2,
        y + WINDOW_THICKNESS
      );
    } else {
      const x =
        windowMeta.side === "west"
          ? WALL_THICKNESS - WINDOW_THICKNESS / 2
          : SCENE_WIDTH - WALL_THICKNESS - WINDOW_THICKNESS / 2;
      windowShape.fillRoundedRect(x, opening.y, WINDOW_THICKNESS, opening.height, 5);
      windowShape.strokeRoundedRect(x, opening.y, WINDOW_THICKNESS, opening.height, 5);
      windowShape.lineBetween(
        x,
        opening.y + opening.height / 2,
        x + WINDOW_THICKNESS,
        opening.y + opening.height / 2
      );
    }

    target.add(windowShape);

    const glow = scene.add.graphics();
    glow.fillStyle(0xffffff, 0.22);
    if (windowMeta.side === "north" || windowMeta.side === "south") {
      const y =
        windowMeta.side === "north"
          ? WALL_THICKNESS + 1
          : SCENE_HEIGHT - WALL_THICKNESS - 5;
      glow.fillRoundedRect(opening.x + 8, y, opening.width - 16, 4, 2);
    } else {
      const x =
        windowMeta.side === "west"
          ? WALL_THICKNESS + 1
          : SCENE_WIDTH - WALL_THICKNESS - 5;
      glow.fillRoundedRect(x, opening.y + 8, 4, opening.height - 16, 2);
    }
    target.add(glow);
  });
}

function createRoomLayer(
  scene: PhaserType.Scene,
  room: RoomConfig,
  initialRoom: HomeRoomId
) {
  const container = scene.add.container(
    room.id === initialRoom ? 0 : SCENE_WIDTH,
    0
  );
  container.setVisible(room.id === initialRoom);
  container.setDepth(1);

  drawFloorPattern(scene, container, room);
  drawWalls(scene, container, room);
  drawDoors(scene, container, room);
  drawWindows(scene, container, room);

  const roomTitle = scene.add.text(28, 24, `${room.emoji} ${room.label}`, {
    color: "#4b3626",
    fontSize: "18px",
    fontStyle: "bold",
    backgroundColor: "rgba(255,248,240,0.72)",
    padding: { x: 8, y: 4 },
  });
  container.add(roomTitle);

  const furnitureLayer = scene.add.container(0, 0);
  furnitureLayer.setDepth(4);
  container.add(furnitureLayer);

  return {
    container,
    furnitureLayer,
  };
}

function buildVisualSize(widthPx: number, heightPx: number) {
  return {
    width: Math.max(widthPx, 44),
    height: Math.max(heightPx, 36),
  };
}

function createFurnitureNode(
  scene: PhaserType.Scene,
  runtime: typeof import("phaser"),
  x: number,
  y: number,
  label: string,
  visualKey: FurnitureVisualKey,
  widthPx: number,
  heightPx: number,
  hintText: string | null,
  onPress: (() => void) | null
) {
  const container = scene.add.container(x, y);
  const bounds = getFurnitureVisualBounds(visualKey, widthPx, heightPx);

  const shadow = scene.add.ellipse(
    0,
    bounds.height / 2 - Math.max(8, bounds.height * 0.12),
    Math.max(28, bounds.width * 0.74),
    Math.max(10, bounds.height * 0.22),
    0x000000,
    0.16
  );
  shadow.setScale(1, 0.72);
  container.add(shadow);

  const visual = scene.add.image(0, 0, FURNITURE_TEXTURE_KEYS[visualKey]);
  visual.setDisplaySize(bounds.width, bounds.height);
  visual.setOrigin(0.5);
  container.add(visual);

  const caption = scene.add.text(0, bounds.height / 2 + 10, label, {
    color: "#4b3626",
    fontSize: "12px",
    fontStyle: "bold",
    backgroundColor: "rgba(255,248,240,0.82)",
    padding: { x: 5, y: 2 },
  });
  caption.setOrigin(0.5);
  container.add(caption);

  let hint: PhaserType.GameObjects.Text | null = null;
  if (hintText) {
    hint = scene.add.text(0, -bounds.height / 2 - 16, hintText, {
      color: "#7c2d12",
      fontSize: "10px",
      backgroundColor: "rgba(255,255,255,0.88)",
      padding: { x: 4, y: 1 },
    });
    hint.setOrigin(0.5);
    container.add(hint);
  }

  if (onPress) {
    container.setSize(bounds.width, bounds.height);
    container.setInteractive(
      new runtime.Geom.Rectangle(
        -bounds.width / 2,
        -bounds.height / 2,
        bounds.width,
        bounds.height
      ),
      runtime.Geom.Rectangle.Contains
    );
    container.on("pointerdown", onPress);
    container.on("pointerover", () => container.setScale(1.02));
    container.on("pointerout", () => container.setScale(1));
  }

  return {
    container,
    caption,
    hint,
    width: bounds.width,
    height: bounds.height,
  };
}

function createHomeScene(
  PhaserRuntime: typeof import("phaser"),
  refs: SceneRefs
): PhaserType.Scene {
  const scene = new PhaserRuntime.Scene("pet-home-scene") as PhaserType.Scene & {
    create?: () => void;
  };

  const petSprites = new Map<number, PetSprite>();
  const roomLayers = new Map<HomeRoomId, RoomLayer>();
  const rotateTapTimestamps = new Map<number, number>();
  let activeRoomId = refs.currentRoomRef.current;
  let moodText: PhaserType.GameObjects.Text | null = null;
  let behaviorText: PhaserType.GameObjects.Text | null = null;
  let roomNameText: PhaserType.GameObjects.Text | null = null;

  const popEmoji = (x: number, y: number, emoji: string) => {
    const txt = scene.add.text(x, y - 24, emoji, { fontSize: "22px" });
    txt.setOrigin(0.5);
    txt.setDepth(12);
    scene.tweens.add({
      targets: txt,
      y: y - 64,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });
  };

  const updatePetLabelPosition = (sprite: PetSprite) => {
    sprite.label.setPosition(sprite.container.x, sprite.container.y - 42);
  };

  const clearActiveText = (sprite: PetSprite) => {
    if (!sprite.activeText) {
      return;
    }

    scene.tweens.killTweensOf(sprite.activeText);
    sprite.activeText.destroy();
    sprite.activeText = null;
  };

  const resetPetSpritePose = (sprite: PetSprite) => {
    scene.tweens.killTweensOf(sprite.container);
    scene.tweens.killTweensOf(sprite.label);
    clearActiveText(sprite);
    sprite.container.setScale(1);
    sprite.container.setAngle(0);
    sprite.mouth.setText("-");
    updatePetLabelPosition(sprite);
    sprite.currentTile = {
      tileX: snapWorldToTile(sprite.container.x),
      tileY: snapWorldToTile(sprite.container.y),
    };
    sprite.isBusy = false;
  };

  const showPetFloatingText = (
    sprite: PetSprite,
    text: string,
    durationMs: number
  ) => {
    clearActiveText(sprite);

    const txt = scene.add.text(sprite.container.x, sprite.container.y - 52, text, {
      color: "#7c2d12",
      fontSize: "18px",
      fontStyle: "bold",
      backgroundColor: "rgba(255,255,255,0.78)",
      padding: { x: 4, y: 1 },
    });
    txt.setOrigin(0.5);
    txt.setDepth(12);
    sprite.activeText = txt;

    scene.tweens.add({
      targets: txt,
      y: txt.y - 16,
      alpha: 0,
      duration: durationMs,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (sprite.activeText === txt) {
          sprite.activeText = null;
        }
        txt.destroy();
      },
    });
  };

  const getRoomObstacleFootprints = (roomId: HomeRoomId) => {
    const actionCoverage = new Set<HomeSceneObjectAction>();
    const footprints: ObstacleFootprint[] = [];

    refs.furnitureRef.current
      .filter((item) => resolvePlacedFurnitureRoom(item) === roomId)
      .forEach((item) => {
        const action = normalizeBehaviorAction(item.template.interaction_action);
        if (action) {
          actionCoverage.add(action);
        }

        const { widthTiles, heightTiles } = getRotatedTileSize(item);
        footprints.push({
          key: `placed:${item.id}`,
          roomId,
          tile: { tileX: item.tile_x, tileY: item.tile_y },
          widthTiles,
          heightTiles,
          action,
          category: item.template.category,
        });
      });

    (
      Object.entries(HOME_SCENE_OBJECTS) as Array<
        [HomeSceneObjectAction, HomeSceneObjectMeta]
      >
    )
      .filter(([action, meta]) => meta.room === roomId && !actionCoverage.has(action))
      .forEach(([action, meta]) => {
        const { widthTiles, heightTiles } = getDefaultObjectTileSize(action);
        footprints.push({
          key: `default:${roomId}:${action}`,
          roomId,
          tile: { tileX: meta.tileX, tileY: meta.tileY },
          widthTiles,
          heightTiles,
          action,
          category: action === "play" ? "toy" : null,
        });
      });

    return footprints;
  };

  const buildBlockedTileSet = (obstacles: ObstacleFootprint[]) => {
    const blockedTiles = new Set<string>();

    obstacles.forEach((obstacle) => {
      const rect = getFootprintRect(
        obstacle.tile,
        obstacle.widthTiles,
        obstacle.heightTiles
      );
      getTilesInRect(rect).forEach((tile) => {
        if (isInteriorTile(tile)) {
          blockedTiles.add(toTileKey(tile));
        }
      });
    });

    return blockedTiles;
  };

  const getBehaviorContext = (
    petId: number,
    obstacles: ObstacleFootprint[] = getRoomObstacleFootprints(activeRoomId)
  ) => ({
    hasToy: obstacles.some(
      (obstacle) => obstacle.action === "play" || obstacle.category === "toy"
    ),
    hasOtherPets: refs.petsRef.current.some((pet) => pet.id !== petId),
    socialEmotion:
      refs.petsRef.current.find((pet) => pet.id === petId)?.recentSocialEmotion ?? null,
  });

  const findIdlePath = (
    roomId: HomeRoomId,
    sprite: PetSprite,
    blockedTiles: Set<string>
  ): TilePoint[] | null => {
    const room = getRoomConfig(roomId);
    const idleCandidates = room.idlePoints.map((_, offset) =>
      getNextIdlePoint(roomId, sprite.idleIndex + offset)
    );

    return findBestPath(sprite.currentTile, idleCandidates, blockedTiles);
  };

  const findActionPath = (
    roomId: HomeRoomId,
    sprite: PetSprite,
    behaviorTarget: HomeSceneObjectAction | null,
    obstacles: ObstacleFootprint[],
    blockedTiles: Set<string>
  ): TilePoint[] | null => {
    if (!behaviorTarget) {
      return [];
    }

    const targetObstacle = obstacles.find(
      (obstacle) => obstacle.roomId === roomId && obstacle.action === behaviorTarget
    );
    if (!targetObstacle) {
      return null;
    }

    const approachTiles = getAdjacentTilesForRect(
      getFootprintRect(
        targetObstacle.tile,
        targetObstacle.widthTiles,
        targetObstacle.heightTiles
      )
    );

    return findBestPath(sprite.currentTile, approachTiles, blockedTiles);
  };

  const findSocialPath = (
    petId: number,
    sprite: PetSprite,
    blockedTiles: Set<string>
  ): { path: TilePoint[]; partner: PetSprite } | null => {
    let bestMatch: { path: TilePoint[]; partner: PetSprite } | null = null;

    petSprites.forEach((otherSprite, otherPetId) => {
      if (otherPetId === petId) {
        return;
      }

      const candidatePath = findBestPath(
        sprite.currentTile,
        getAdjacentTilesForRect(getFootprintRect(otherSprite.currentTile, 1, 1)),
        blockedTiles
      );
      if (!candidatePath) {
        return;
      }

      if (!bestMatch || candidatePath.length < bestMatch.path.length) {
        bestMatch = {
          path: candidatePath,
          partner: otherSprite,
        };
      }
    });

    return bestMatch;
  };

  const maybePopHappyHeart = (sprite: PetSprite, petData: PetSceneData) => {
    if (petData.petStatus?.mood === "happy" && Math.random() < 0.35) {
      popEmoji(sprite.container.x, sprite.container.y, "\u2764");
    }
  };

  const finishPetAnimation = (sprite: PetSprite, petData: PetSceneData) => {
    updatePetLabelPosition(sprite);
    maybePopHappyHeart(sprite, petData);
    sprite.isBusy = false;
  };

  const playArrivalAnimation = (
    sprite: PetSprite,
    petData: PetSceneData,
    behavior: HomeSceneBehavior,
    socialPartner: PetSprite | null
  ) => {
    switch (behavior.state) {
      case "seeking_food":
      case "seeking_water":
        sprite.mouth.setText("o");
        scene.tweens.add({
          targets: sprite.container,
          y: sprite.container.y + 6,
          angle: behavior.state === "seeking_food" ? -6 : 6,
          duration: 180,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
          onUpdate: () => updatePetLabelPosition(sprite),
          onComplete: () => {
            sprite.container.setAngle(0);
            sprite.mouth.setText("-");
            finishPetAnimation(sprite, petData);
          },
        });
        return;
      case "sleeping":
        sprite.mouth.setText("_");
        showPetFloatingText(sprite, "zzz", 1200);
        scene.tweens.add({
          targets: sprite.container,
          scaleX: 0.85,
          scaleY: 0.85,
          duration: 220,
          ease: "Sine.easeOut",
          onUpdate: () => updatePetLabelPosition(sprite),
          onComplete: () => finishPetAnimation(sprite, petData),
        });
        return;
      case "playing":
        sprite.mouth.setText("w");
        scene.tweens.add({
          targets: sprite.container,
          y: sprite.container.y - 8,
          duration: 180,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
          onUpdate: () => updatePetLabelPosition(sprite),
          onComplete: () => {
            sprite.mouth.setText("-");
            finishPetAnimation(sprite, petData);
          },
        });
        return;
      case "grooming":
        sprite.mouth.setText("~");
        scene.tweens.add({
          targets: sprite.container,
          angle: 15,
          duration: 140,
          yoyo: true,
          repeat: 2,
          ease: "Sine.easeInOut",
          onUpdate: () => updatePetLabelPosition(sprite),
          onComplete: () => {
            sprite.container.setAngle(0);
            sprite.mouth.setText("-");
            finishPetAnimation(sprite, petData);
          },
        });
        return;
      case "social":
        sprite.mouth.setText("o");
        if (petData.recentSocialEmotion === "warm") {
          popEmoji(sprite.container.x, sprite.container.y, "\u2764");
          showPetFloatingText(sprite, "靠近一点", 1000);
        } else if (petData.recentSocialEmotion === "curious") {
          popEmoji(sprite.container.x, sprite.container.y, "\u{1F440}");
          showPetFloatingText(sprite, "先闻闻看", 1000);
        } else if (petData.recentSocialEmotion === "excited") {
          popEmoji(sprite.container.x, sprite.container.y, "\u2728");
          showPetFloatingText(sprite, "好耶", 900);
        } else if (petData.recentSocialEmotion === "calm") {
          popEmoji(sprite.container.x, sprite.container.y, "\u{1F44B}");
          showPetFloatingText(sprite, "慢慢靠近", 1000);
        } else {
          popEmoji(sprite.container.x, sprite.container.y, "\u{1F44B}");
        }
        if (socialPartner) {
          if (petData.recentSocialEmotion === "warm") {
            popEmoji(socialPartner.container.x, socialPartner.container.y, "\u2764");
          } else if (petData.recentSocialEmotion === "curious") {
            popEmoji(socialPartner.container.x, socialPartner.container.y, "\u{1F440}");
          } else if (petData.recentSocialEmotion === "excited") {
            popEmoji(socialPartner.container.x, socialPartner.container.y, "\u2728");
          } else {
            popEmoji(socialPartner.container.x, socialPartner.container.y, "\u{1F44B}");
          }
        }
        scene.tweens.add({
          targets: sprite.container,
          scaleX:
            petData.recentSocialEmotion === "excited"
              ? 1.08
              : petData.recentSocialEmotion === "guarded"
                ? 0.98
                : 1.04,
          scaleY:
            petData.recentSocialEmotion === "excited"
              ? 0.92
              : petData.recentSocialEmotion === "guarded"
                ? 1.01
                : 0.96,
          duration: 180,
          yoyo: true,
          repeat: petData.recentSocialEmotion === "excited" ? 2 : 1,
          ease: "Sine.easeInOut",
          angle:
            petData.recentSocialEmotion === "curious"
              ? -8
              : petData.recentSocialEmotion === "guarded"
                ? -3
                : 0,
          onUpdate: () => updatePetLabelPosition(sprite),
          onComplete: () => {
            sprite.container.setAngle(0);
            sprite.mouth.setText("-");
            finishPetAnimation(sprite, petData);
          },
        });
        return;
      default:
        finishPetAnimation(sprite, petData);
    }
  };

  const animatePetAlongPath = (
    sprite: PetSprite,
    petData: PetSceneData,
    behavior: HomeSceneBehavior,
    path: TilePoint[],
    socialPartner: PetSprite | null
  ) => {
    resetPetSpritePose(sprite);
    sprite.isBusy = true;

    if (path.length === 0) {
      playArrivalAnimation(sprite, petData, behavior, socialPartner);
      return;
    }

    let stepIndex = 0;
    const moveNext = () => {
      if (refs.editModeRef.current) {
        resetPetSpritePose(sprite);
        return;
      }

      const nextTile = path[stepIndex];
      if (!nextTile) {
        playArrivalAnimation(sprite, petData, behavior, socialPartner);
        return;
      }

      const point = toWorld(nextTile.tileX, nextTile.tileY);
      scene.tweens.add({
        targets: sprite.container,
        x: point.x,
        y: point.y,
        duration: 200,
        ease: "Sine.easeInOut",
        onStart: () => {
          sprite.mouth.setText("o");
          scene.tweens.add({
            targets: sprite.container,
            scaleX: 1.04,
            scaleY: 0.96,
            duration: 100,
            yoyo: true,
            ease: "Sine.easeInOut",
          });
        },
        onUpdate: () => updatePetLabelPosition(sprite),
        onComplete: () => {
          sprite.currentTile = nextTile;
          stepIndex += 1;
          moveNext();
        },
      });
    };

    moveNext();
  };

  const refreshStatus = () => {
    for (const [petId, sprite] of petSprites) {
      const petData = refs.petsRef.current.find((pet) => pet.id === petId);
      if (!petData) {
        continue;
      }

      sprite.tintParts.forEach((part) => part.setFillStyle(getPetTint(petData.petStatus)));
      sprite.label.setText(petData.petName);
    }

    const firstPet = refs.petsRef.current[0];
    if (firstPet && moodText) {
      moodText.setText(`当前心情：${firstPet.petStatus?.mood ?? "normal"}`);
    }
    if (firstPet && behaviorText) {
      behaviorText.setText(
        `行为状态：${getHomeSceneBehavior(
          firstPet.petStatus,
          getBehaviorContext(firstPet.id)
        ).label}`
      );
    }
    if (roomNameText) {
      roomNameText.setText(`当前房间：${getRoomConfig(activeRoomId).label}`);
    }
  };

  const updateFurnitureDraft = (nextFurniture: PlacedFurnitureResponse[]) => {
    refs.furnitureRef.current = nextFurniture;
    refs.furnitureChangeRef.current?.(nextFurniture);
  };

  const reportEditError = (message: string) => {
    refs.editErrorRef.current?.(message);
  };

  const attachEditableFurnitureBehavior = (
    node: FurnitureNode,
    item: PlacedFurnitureResponse
  ) => {
    node.container.setSize(node.width, node.height);
    node.container.setInteractive(
      new PhaserRuntime.Geom.Rectangle(
        -node.width / 2,
        -node.height / 2,
        node.width,
        node.height
      ),
      PhaserRuntime.Geom.Rectangle.Contains
    );
    scene.input.setDraggable(node.container);

    let startX = node.container.x;
    let startY = node.container.y;
    let dragMoved = false;

    node.container.on("pointerdown", () => {
      if (!refs.editModeRef.current) {
        return;
      }

      const now = Date.now();
      const lastTapAt = rotateTapTimestamps.get(item.id) ?? 0;
      rotateTapTimestamps.set(item.id, now);

      if (now - lastTapAt > 280) {
        return;
      }

      const nextRotation = ((normalizeRotation(item.rotation) + 90) % 360) as
        PlacedFurnitureResponse["rotation"];
      const nextItem: PlacedFurnitureResponse = {
        ...item,
        rotation: nextRotation,
      };

      if (!isFurnitureInsideRoom(nextItem)) {
        reportEditError("旋转后家具会碰到墙壁");
        return;
      }
      if (furnitureOverlaps(nextItem, refs.furnitureRef.current)) {
        reportEditError("旋转后会和其它家具重叠");
        return;
      }

      updateFurnitureDraft(
        refs.furnitureRef.current.map((currentItem) =>
          currentItem.id === item.id ? nextItem : currentItem
        )
      );
    });

    node.container.on("dragstart", () => {
      if (!refs.editModeRef.current) {
        return;
      }
      dragMoved = false;
      startX = node.container.x;
      startY = node.container.y;
      node.container.setAlpha(0.66);
    });

    node.container.on(
      "drag",
      (_pointer: PhaserType.Input.Pointer, dragX: number, dragY: number) => {
        if (!refs.editModeRef.current) {
          return;
        }

        dragMoved = true;
        const snappedTileX = snapWorldToTile(dragX);
        const snappedTileY = snapWorldToTile(dragY);
        const snappedPoint = toWorld(snappedTileX, snappedTileY);
        node.container.setPosition(snappedPoint.x, snappedPoint.y);
      }
    );

    node.container.on("dragend", () => {
      if (!refs.editModeRef.current) {
        return;
      }

      node.container.setAlpha(1);
      if (!dragMoved) {
        node.container.setPosition(startX, startY);
        return;
      }

      const nextTileX = snapWorldToTile(node.container.x);
      const nextTileY = snapWorldToTile(node.container.y);
      const nextItem: PlacedFurnitureResponse = {
        ...item,
        room: activeRoomId,
        tile_x: nextTileX,
        tile_y: nextTileY,
      };

      if (!isFurnitureInsideRoom(nextItem)) {
        node.container.setPosition(startX, startY);
        reportEditError("家具不能放在墙内");
        return;
      }
      if (furnitureOverlaps(nextItem, refs.furnitureRef.current)) {
        node.container.setPosition(startX, startY);
        reportEditError("目标位置已有家具");
        return;
      }

      const snappedPoint = toWorld(nextTileX, nextTileY);
      node.container.setPosition(snappedPoint.x, snappedPoint.y);
      updateFurnitureDraft(
        refs.furnitureRef.current.map((currentItem) =>
          currentItem.id === item.id ? nextItem : currentItem
        )
      );
    });
  };

  const renderRoomFurniture = (roomId: HomeRoomId) => {
    const roomLayer = roomLayers.get(roomId);
    if (!roomLayer) {
      return;
    }

    roomLayer.furnitureLayer.removeAll(true);

    const placedInRoom = refs.furnitureRef.current.filter(
      (item) => resolvePlacedFurnitureRoom(item) === roomId
    );
    const actionCoverage = new Set<HomeSceneObjectAction>();

    placedInRoom.forEach((item) => {
      const action = item.template.interaction_action as HomeSceneObjectAction | null;
      const { x, y } = toWorld(item.tile_x, item.tile_y);

      if (action) {
        actionCoverage.add(action);
      }

      const node = createFurnitureNode(
        scene,
        PhaserRuntime,
        x,
        y,
        item.template.name,
        getFurnitureVisualKey(item.template.sprite_key, action),
        item.template.width * TILE_SIZE,
        item.template.height * TILE_SIZE,
        action ? HOME_SCENE_OBJECTS[action].badgeLabel : null,
        !refs.editModeRef.current && action
          ? () => {
              refs.actionRef.current(action, -1);
              const emojiMap: Record<HomeSceneObjectAction, string> = {
                feed: "🍖",
                drink: "💧",
                play: "🎾",
                bed: "😴",
              };
              popEmoji(x, y, emojiMap[action]);
            }
          : null
      );
      const rotation = normalizeRotation(item.rotation);
      node.container.setAngle(rotation);
      node.caption.setAngle(-rotation);
      node.hint?.setAngle(-rotation);

      if (refs.editModeRef.current) {
        attachEditableFurnitureBehavior(node, {
          ...item,
          room: resolvePlacedFurnitureRoom(item),
          rotation,
        });
      }

      roomLayer.furnitureLayer.add(node.container);
    });

    (
      Object.entries(HOME_SCENE_OBJECTS) as Array<
        [HomeSceneObjectAction, HomeSceneObjectMeta]
      >
    )
      .filter(([, meta]) => meta.room === roomId)
      .forEach(([action, meta]) => {
        if (actionCoverage.has(action)) {
          return;
        }

        const { x, y } = toWorld(meta.tileX, meta.tileY);
        const node = createFurnitureNode(
          scene,
          PhaserRuntime,
          x,
          y,
          meta.label,
          getFurnitureVisualKey(undefined, action),
          action === "bed" ? TILE_SIZE * 4 : TILE_SIZE * 2,
          action === "bed" ? TILE_SIZE * 3 : TILE_SIZE * 2,
          meta.badgeLabel,
          refs.editModeRef.current
            ? null
            : () => {
                refs.actionRef.current(action, -1);
                const emojiMap: Record<HomeSceneObjectAction, string> = {
                  feed: "🍖",
                  drink: "💧",
                  play: "🎾",
                  bed: "😴",
                };
                popEmoji(x, y, emojiMap[action]);
              }
        );
        roomLayer.furnitureLayer.add(node.container);
      });
  };

  const syncFurniture = () => {
    roomLayers.forEach((_, roomId) => {
      renderRoomFurniture(roomId);
    });

    if (refs.editModeRef.current) {
      petSprites.forEach((sprite) => {
        resetPetSpritePose(sprite);
      });
    }
  };

  const setPetPosition = (
    sprite: PetSprite,
    roomId: HomeRoomId,
    fadeIn: boolean
  ) => {
    const spot = getRoomPetPoint(roomId, sprite.slotIndex);
    const point = toWorld(spot.tileX, spot.tileY);

    resetPetSpritePose(sprite);
    sprite.container.setPosition(point.x, point.y);
    sprite.label.setPosition(point.x, point.y - 42);
    sprite.container.setAlpha(fadeIn ? 0 : 1);
    sprite.label.setAlpha(fadeIn ? 0 : 1);
    sprite.currentTile = spot;
    sprite.isBusy = false;

    if (fadeIn) {
      scene.tweens.add({
        targets: [sprite.container, sprite.label],
        alpha: 1,
        duration: 220,
        delay: 80,
        ease: "Sine.easeOut",
      });
    }
  };

  const createPetSprite = (petData: PetSceneData, slotIndex: number) => {
    const spriteSpec = getHomePetSpriteSpec(petData.petSpecies);
    const startPoint = toWorld(
      getRoomPetPoint(activeRoomId, slotIndex).tileX,
      getRoomPetPoint(activeRoomId, slotIndex).tileY
    );

    const shadow = scene.add.ellipse(0, 20, 34, 12, 0x7c5b2d, 0.18);
    const body = scene.add.ellipse(
      0,
      0,
      spriteSpec.bodyWidth,
      spriteSpec.bodyHeight,
      getPetTint(petData.petStatus)
    );

    const leftEar =
      spriteSpec.earStyle === "floppy"
        ? scene.add.ellipse(-14, -10, 12, 22, 0x92400e)
        : spriteSpec.earStyle === "long"
          ? scene.add.ellipse(-10, -22, 10, 28, 0xf8fafc)
          : scene.add.triangle(-10, -16, 0, 0, 8, -16, 16, 0, 0xeab308);
    const rightEar =
      spriteSpec.earStyle === "floppy"
        ? scene.add.ellipse(14, -10, 12, 22, 0x92400e)
        : spriteSpec.earStyle === "long"
          ? scene.add.ellipse(10, -22, 10, 28, 0xf8fafc)
          : scene.add.triangle(10, -16, 0, 0, 8, -16, 16, 0, 0xeab308);

    const tail =
      spriteSpec.tailStyle === "curled"
        ? scene.add.ellipse(20, 4, 12, 24, 0x92400e)
        : spriteSpec.tailStyle === "cotton"
          ? scene.add.circle(18, 8, 7, 0xffffff)
          : spriteSpec.tailStyle === "bushy"
            ? scene.add.ellipse(22, 4, 16, 28, 0xf59e0b)
            : scene.add.ellipse(18, 10, 10, 20, 0xeab308);

    const face = scene.add.text(0, -1, spriteSpec.face, {
      color: "#1f2937",
      fontSize: "12px",
    });
    face.setOrigin(0.5);

    const leftEye = scene.add.circle(-7, -4, 3, 0x1f2937);
    const rightEye = scene.add.circle(7, -4, 3, 0x1f2937);
    const leftPupil = scene.add.circle(-6, -5, 1.5, 0xffffff);
    const rightPupil = scene.add.circle(8, -5, 1.5, 0xffffff);
    const mouth = scene.add.text(0, 8, "-", {
      color: "#1f2937",
      fontSize: "10px",
    });
    mouth.setOrigin(0.5);
    const blushLeft = scene.add.ellipse(-11, 2, 8, 5, 0xff9999, 0.35);
    const blushRight = scene.add.ellipse(11, 2, 8, 5, 0xff9999, 0.35);

    const tintParts: PhaserType.GameObjects.Shape[] = [body, leftEar, rightEar, tail];
    const petContainer = scene.add.container(startPoint.x, startPoint.y, [
      shadow,
      tail,
      body,
      leftEar,
      rightEar,
      face,
      leftEye,
      rightEye,
      leftPupil,
      rightPupil,
      mouth,
      blushLeft,
      blushRight,
    ]);
    petContainer.setDepth(7);
    petContainer.setSize(spriteSpec.bodyWidth + 20, spriteSpec.bodyHeight + 20);
    petContainer.setInteractive(
      new PhaserRuntime.Geom.Rectangle(
        -(spriteSpec.bodyWidth + 20) / 2,
        -(spriteSpec.bodyHeight + 20) / 2,
        spriteSpec.bodyWidth + 20,
        spriteSpec.bodyHeight + 20
      ),
      PhaserRuntime.Geom.Rectangle.Contains
    );
    petContainer.on("pointerover", () => {
      tintParts.forEach((part) => part.setAlpha(0.85));
    });
    petContainer.on("pointerout", () => {
      tintParts.forEach((part) => part.setAlpha(1));
    });
    petContainer.on("pointerdown", () => {
      refs.actionRef.current("pet", petData.id);
      popEmoji(petContainer.x, petContainer.y, "💬");
    });

    const petLabel = scene.add.text(startPoint.x, startPoint.y - 42, petData.petName, {
      color: "#7c2d12",
      fontSize: "14px",
      fontStyle: "bold",
      backgroundColor: "#fff7ed",
      padding: { x: 6, y: 3 },
    });
    petLabel.setOrigin(0.5);
    petLabel.setDepth(8);

    const startTile = getRoomPetPoint(activeRoomId, slotIndex);
    petSprites.set(petData.id, {
      container: petContainer,
      tintParts,
      label: petLabel,
      mouth,
      slotIndex,
      idleIndex: slotIndex * 2,
      currentTile: startTile,
      isBusy: false,
      activeText: null,
    });
  };

  const createPets = () => {
    refs.petsRef.current.forEach((petData, index) => {
      createPetSprite(petData, index);
    });

    moodText = scene.add.text(24, SCENE_HEIGHT - 72, "", {
      color: "#6b4f2c",
      fontSize: "14px",
      fontStyle: "bold",
      backgroundColor: "rgba(255,248,240,0.7)",
      padding: { x: 6, y: 3 },
    });
    moodText.setDepth(9);

    behaviorText = scene.add.text(24, SCENE_HEIGHT - 42, "", {
      color: "#6b4f2c",
      fontSize: "13px",
      backgroundColor: "rgba(255,248,240,0.7)",
      padding: { x: 6, y: 3 },
    });
    behaviorText.setDepth(9);

    roomNameText = scene.add.text(SCENE_WIDTH - 24, SCENE_HEIGHT - 42, "", {
      color: "#6b4f2c",
      fontSize: "13px",
      backgroundColor: "rgba(255,248,240,0.7)",
      padding: { x: 6, y: 3 },
    });
    roomNameText.setOrigin(1, 0);
    roomNameText.setDepth(9);
  };

  const movePetSprite = (petId: number) => {
    const sprite = petSprites.get(petId);
    if (!sprite || refs.editModeRef.current || sprite.isBusy) {
      return;
    }

    const petData = refs.petsRef.current.find((pet) => pet.id === petId);
    if (!petData) {
      return;
    }

    const obstacles = getRoomObstacleFootprints(activeRoomId);
    const blockedTiles = buildBlockedTileSet(obstacles);
    const behavior = getHomeSceneBehavior(
      petData.petStatus,
      getBehaviorContext(petId, obstacles)
    );

    sprite.idleIndex += 1;
    let path: TilePoint[] | null = null;
    let socialPartner: PetSprite | null = null;

    if (
      behavior.state === "seeking_food" ||
      behavior.state === "seeking_water" ||
      behavior.state === "seeking_rest" ||
      behavior.state === "playing" ||
      behavior.state === "sleeping"
    ) {
      path = findActionPath(
        activeRoomId,
        sprite,
        behavior.target,
        obstacles,
        blockedTiles
      );
    } else if (behavior.state === "social") {
      const socialPath = findSocialPath(petId, sprite, blockedTiles);
      if (socialPath) {
        path = socialPath.path;
        socialPartner = socialPath.partner;
      }
    } else if (behavior.state === "grooming") {
      path = [];
    } else {
      path = findIdlePath(activeRoomId, sprite, blockedTiles);
    }

    if (!path) {
      path = findIdlePath(activeRoomId, sprite, blockedTiles);
    }
    if (!path) {
      path = [];
    }

    animatePetAlongPath(sprite, petData, behavior, path, socialPartner);
  };

  const setRoom = (nextRoomId: HomeRoomId) => {
    if (nextRoomId === activeRoomId) {
      return;
    }

    const currentLayer = roomLayers.get(activeRoomId);
    const nextLayer = roomLayers.get(nextRoomId);
    if (!currentLayer || !nextLayer) {
      activeRoomId = nextRoomId;
      refs.currentRoomRef.current = nextRoomId;
      refreshStatus();
      return;
    }

    const direction = getRoomIndex(nextRoomId) > getRoomIndex(activeRoomId) ? 1 : -1;
    currentLayer.container.setVisible(true);
    nextLayer.container.setVisible(true);
    nextLayer.container.x = direction * SCENE_WIDTH;

    activeRoomId = nextRoomId;
    refs.currentRoomRef.current = nextRoomId;
    petSprites.forEach((sprite) => {
      setPetPosition(sprite, nextRoomId, true);
    });
    refreshStatus();

    scene.tweens.killTweensOf(currentLayer.container);
    scene.tweens.killTweensOf(nextLayer.container);
    scene.tweens.add({
      targets: currentLayer.container,
      x: -direction * SCENE_WIDTH,
      duration: ROOM_TRANSITION_MS,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        currentLayer.container.setVisible(false);
      },
    });
    scene.tweens.add({
      targets: nextLayer.container,
      x: 0,
      duration: ROOM_TRANSITION_MS,
      ease: "Cubic.easeInOut",
    });
  };

  scene.create = () => {
    ensureHomeSceneTextures(scene);

    (["living", "bedroom", "kitchen"] as HomeRoomId[]).forEach((roomId) => {
      roomLayers.set(roomId, createRoomLayer(scene, getRoomConfig(roomId), activeRoomId));
    });

    syncFurniture();
    createPets();
    refreshStatus();

    scene.time.addEvent({
      delay: 2300,
      loop: true,
      callback: () => {
        petSprites.forEach((_, petId) => {
          movePetSprite(petId);
        });
      },
    });

    refs.apiRef.current = {
      refresh: refreshStatus,
      setRoom,
      syncFurniture,
    };

    scene.events.once("shutdown", () => {
      refs.apiRef.current = null;
    });
  };

  return scene;
}

export function PetHomeScene({
  pets,
  currentRoom,
  isEditMode = false,
  onAction,
  placedFurniture = [],
  onPlacedFurnitureChange,
  onEditError,
}: PetHomeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestPetsRef = useRef<PetSceneData[]>(pets);
  const latestActionRef = useRef(onAction);
  const latestRoomRef = useRef<HomeRoomId>(currentRoom);
  const latestEditModeRef = useRef(isEditMode);
  const latestFurnitureRef = useRef<PlacedFurnitureResponse[]>(placedFurniture);
  const latestFurnitureChangeRef = useRef(onPlacedFurnitureChange);
  const latestEditErrorRef = useRef(onEditError);
  const sceneApiRef = useRef<SceneApi | null>(null);

  latestPetsRef.current = pets;
  latestActionRef.current = onAction;
  latestRoomRef.current = currentRoom;
  latestEditModeRef.current = isEditMode;
  latestFurnitureRef.current = placedFurniture;
  latestFurnitureChangeRef.current = onPlacedFurnitureChange;
  latestEditErrorRef.current = onEditError;

  useEffect(() => {
    let destroyed = false;
    let game: PhaserType.Game | null = null;

    const init = async () => {
      const PhaserModule = await import("phaser");
      const Phaser = (PhaserModule.default ?? PhaserModule) as typeof import("phaser");

      if (destroyed || !containerRef.current) {
        return;
      }

      const scene = createHomeScene(Phaser, {
        petsRef: latestPetsRef,
        actionRef: latestActionRef,
        currentRoomRef: latestRoomRef,
        editModeRef: latestEditModeRef,
        furnitureRef: latestFurnitureRef,
        furnitureChangeRef: latestFurnitureChangeRef,
        editErrorRef: latestEditErrorRef,
        apiRef: sceneApiRef,
      });

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        backgroundColor: "#fff7ed",
        scene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });
    };

    void init();

    return () => {
      destroyed = true;
      sceneApiRef.current = null;
      if (game) {
        game.destroy(true);
      }
    };
  }, [pets.length]);

  useEffect(() => {
    sceneApiRef.current?.refresh();
  }, [pets]);

  useEffect(() => {
    sceneApiRef.current?.setRoom(currentRoom);
  }, [currentRoom]);

  useEffect(() => {
    sceneApiRef.current?.syncFurniture();
  }, [placedFurniture, isEditMode]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-orange-200 bg-[#f8efe2] shadow-[0_20px_60px_-28px_rgba(194,120,3,0.45)]">
      <div ref={containerRef} className="aspect-square w-full bg-[#f8efe2]" />
    </div>
  );
}
