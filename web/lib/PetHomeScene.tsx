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

function drawFloorPattern(
  scene: PhaserType.Scene,
  target: PhaserType.GameObjects.Container,
  room: RoomConfig
) {
  const floor = scene.add.graphics();
  floor.fillStyle(room.floorColor, 1);
  floor.fillRect(
    WALL_THICKNESS,
    WALL_THICKNESS,
    SCENE_WIDTH - WALL_THICKNESS * 2,
    SCENE_HEIGHT - WALL_THICKNESS * 2
  );

  if (room.floorStyle === "wood") {
    for (let y = WALL_THICKNESS; y < SCENE_HEIGHT - WALL_THICKNESS; y += 26) {
      const shade = y % 52 === 0 ? 0xd9a87f : 0xba835b;
      floor.fillStyle(shade, 0.26);
      floor.fillRect(
        WALL_THICKNESS,
        y,
        SCENE_WIDTH - WALL_THICKNESS * 2,
        14
      );
    }
    floor.lineStyle(2, 0xa86d47, 0.3);
    for (let x = WALL_THICKNESS + 48; x < SCENE_WIDTH - WALL_THICKNESS; x += 72) {
      floor.lineBetween(x, WALL_THICKNESS, x, SCENE_HEIGHT - WALL_THICKNESS);
    }
  } else if (room.floorStyle === "carpet") {
    for (let x = WALL_THICKNESS + 8; x < SCENE_WIDTH - WALL_THICKNESS; x += 12) {
      floor.lineStyle(1, 0xddcfb9, 0.32);
      floor.lineBetween(x, WALL_THICKNESS + 10, x - 6, SCENE_HEIGHT - WALL_THICKNESS - 10);
    }
    for (let y = WALL_THICKNESS + 18; y < SCENE_HEIGHT - WALL_THICKNESS; y += 26) {
      floor.lineStyle(1, 0xffffff, 0.16);
      floor.lineBetween(WALL_THICKNESS + 12, y, SCENE_WIDTH - WALL_THICKNESS - 12, y);
    }
  } else {
    floor.lineStyle(2, 0xcfcfcf, 0.95);
    for (let x = WALL_THICKNESS; x <= SCENE_WIDTH - WALL_THICKNESS; x += 64) {
      floor.lineBetween(x, WALL_THICKNESS, x, SCENE_HEIGHT - WALL_THICKNESS);
    }
    for (let y = WALL_THICKNESS; y <= SCENE_HEIGHT - WALL_THICKNESS; y += 64) {
      floor.lineBetween(WALL_THICKNESS, y, SCENE_WIDTH - WALL_THICKNESS, y);
    }
  }

  target.add(floor);
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
  const wall = scene.add.graphics();
  wall.fillStyle(room.wallColor, 1);
  wall.fillRect(0, 0, SCENE_WIDTH, WALL_THICKNESS);
  wall.fillRect(0, SCENE_HEIGHT - WALL_THICKNESS, SCENE_WIDTH, WALL_THICKNESS);
  wall.fillRect(0, 0, WALL_THICKNESS, SCENE_HEIGHT);
  wall.fillRect(SCENE_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, SCENE_HEIGHT);

  room.doors.forEach((door) => {
    const opening = getOpeningRect(door);
    wall.fillStyle(room.floorColor, 1);
    wall.fillRect(opening.x, opening.y, opening.width, opening.height);
  });

  wall.lineStyle(2, ROOM_SHADOW_COLOR, 0.28);
  wall.strokeRect(
    WALL_THICKNESS / 2,
    WALL_THICKNESS / 2,
    SCENE_WIDTH - WALL_THICKNESS,
    SCENE_HEIGHT - WALL_THICKNESS
  );
  target.add(wall);

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

function drawFurnitureShape(
  graphics: PhaserType.GameObjects.Graphics,
  visualKey: FurnitureVisualKey,
  widthPx: number,
  heightPx: number
) {
  const { width, height } = buildVisualSize(widthPx, heightPx);
  const halfW = width / 2;
  const halfH = height / 2;

  switch (visualKey) {
    case "feed": {
      const radius = Math.min(width, height) / 2 - 4;
      graphics.fillStyle(0xf7d7b4, 1);
      graphics.fillCircle(0, 0, radius);
      graphics.lineStyle(4, 0xc57c2f, 1);
      graphics.strokeCircle(0, 0, radius);
      graphics.lineStyle(3, 0xf59e0b, 1);
      graphics.strokeCircle(0, 0, radius - 7);
      return { width: radius * 2 + 8, height: radius * 2 + 8 };
    }
    case "drink": {
      const radius = Math.min(width, height) / 2 - 4;
      graphics.fillStyle(0xe7f6ff, 1);
      graphics.fillCircle(0, 0, radius);
      graphics.lineStyle(4, 0x5ea2d8, 1);
      graphics.strokeCircle(0, 0, radius);
      graphics.fillStyle(0x60a5fa, 0.85);
      graphics.fillCircle(0, 1, radius - 7);
      return { width: radius * 2 + 8, height: radius * 2 + 8 };
    }
    case "play": {
      const radius = Math.min(width, height) / 2 - 2;
      graphics.fillStyle(0xfb7185, 1);
      graphics.fillCircle(0, 0, radius);
      graphics.lineStyle(3, 0xffffff, 1);
      graphics.lineBetween(-radius * 0.65, radius * 0.65, radius * 0.65, -radius * 0.65);
      graphics.strokeCircle(0, 0, radius);
      graphics.fillStyle(0xfde68a, 1);
      graphics.fillTriangle(
        -radius * 0.15,
        -radius,
        radius,
        0,
        -radius * 0.15,
        radius
      );
      return { width: radius * 2 + 6, height: radius * 2 + 6 };
    }
    case "bed": {
      graphics.fillStyle(0xa78bfa, 0.28);
      graphics.fillRoundedRect(-halfW, -halfH, width, height, 14);
      graphics.fillStyle(0xc4b5fd, 1);
      graphics.fillRoundedRect(-halfW + 6, -halfH + 6, width - 12, height - 12, 12);
      graphics.fillStyle(0x8b6dd7, 1);
      graphics.fillRect(-halfW, -halfH, width, 14);
      graphics.fillStyle(0xf8f7ff, 0.95);
      graphics.fillRoundedRect(-halfW + 18, -halfH + 18, width - 36, height - 28, 12);
      return { width, height };
    }
    case "sofa": {
      graphics.fillStyle(0x7a4d2d, 1);
      graphics.fillRoundedRect(-halfW, -halfH + 14, width, height - 14, 16);
      graphics.fillRect(-halfW + 10, -halfH, width - 20, 18);
      graphics.fillRect(-halfW, -halfH + 12, 18, height - 22);
      graphics.fillRect(halfW - 18, -halfH + 12, 18, height - 22);
      return { width, height };
    }
    case "catTree": {
      graphics.fillStyle(0xb58a63, 1);
      graphics.fillRect(-12, -halfH + 12, 24, height - 16);
      graphics.fillStyle(0xd1b08d, 1);
      graphics.fillRoundedRect(-halfW, -halfH + 4, width, 18, 8);
      graphics.fillRoundedRect(-halfW + 10, halfH - 18, width - 20, 16, 8);
      return { width, height };
    }
    case "table": {
      graphics.fillStyle(0x9b6b42, 1);
      graphics.fillRoundedRect(-halfW, -halfH + 4, width, height - 16, 10);
      graphics.fillRect(-halfW + 10, halfH - 14, 10, 14);
      graphics.fillRect(halfW - 20, halfH - 14, 10, 14);
      graphics.fillRect(-halfW + 10, -halfH + 4, 10, 14);
      graphics.fillRect(halfW - 20, -halfH + 4, 10, 14);
      return { width, height };
    }
    case "plant": {
      graphics.fillStyle(0xb26a3c, 1);
      graphics.fillRoundedRect(-20, 4, 40, 24, 8);
      graphics.fillStyle(0x46a758, 1);
      graphics.fillCircle(-10, -6, 12);
      graphics.fillCircle(10, -8, 14);
      graphics.fillCircle(0, -16, 13);
      return { width: 52, height: 60 };
    }
    default: {
      graphics.fillStyle(0xe7dccd, 1);
      graphics.fillRoundedRect(-halfW, -halfH, width, height, 12);
      graphics.lineStyle(3, 0xb89e86, 0.95);
      graphics.strokeRoundedRect(-halfW, -halfH, width, height, 12);
      return { width, height };
    }
  }
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
  const graphic = scene.add.graphics();
  const bounds = drawFurnitureShape(graphic, visualKey, widthPx, heightPx);
  container.add(graphic);

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
        popEmoji(sprite.container.x, sprite.container.y, "\u{1F44B}");
        if (socialPartner) {
          popEmoji(
            socialPartner.container.x,
            socialPartner.container.y,
            "\u{1F44B}"
          );
        }
        scene.tweens.add({
          targets: sprite.container,
          scaleX: 1.04,
          scaleY: 0.96,
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
