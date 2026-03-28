"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type * as PhaserType from "phaser";

import {
  getHomeSceneBehavior,
  HOME_SCENE_OBJECTS,
  type HomeSceneObjectAction,
  type HomeSceneObjectMeta,
} from "./home-scene";
import type { PetStatus } from "./PetStatusPanel";

export type SceneAction = "pet" | HomeSceneObjectAction;

type PetHomeSceneProps = {
  petName: string;
  petStatus: PetStatus | null;
  onAction: (action: SceneAction) => void;
};

type SceneRefs = {
  statusRef: MutableRefObject<PetStatus | null>;
  actionRef: MutableRefObject<(action: SceneAction) => void>;
  nameRef: MutableRefObject<string>;
  apiRef: MutableRefObject<{ refresh: () => void } | null>;
};

const GRID_SIZE = 20;
const TILE_SIZE = 28;
const SCENE_WIDTH = GRID_SIZE * TILE_SIZE;
const SCENE_HEIGHT = GRID_SIZE * TILE_SIZE;

const IDLE_POINTS = [
  { tileX: 6, tileY: 6 },
  { tileX: 11, tileY: 5 },
  { tileX: 8, tileY: 10 },
  { tileX: 13, tileY: 11 },
];

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

function createHomeScene(
  PhaserRuntime: typeof import("phaser"),
  refs: SceneRefs
): PhaserType.Scene {
  const scene = new PhaserRuntime.Scene("pet-home-scene") as PhaserType.Scene & {
    create?: () => void;
  };

  let petContainer: PhaserType.GameObjects.Container | null = null;
  let petBody: PhaserType.GameObjects.Arc | null = null;
  let moodText: PhaserType.GameObjects.Text | null = null;
  let behaviorText: PhaserType.GameObjects.Text | null = null;
  let petLabel: PhaserType.GameObjects.Text | null = null;
  let idleIndex = 0;

  const refreshStatus = () => {
    const status = refs.statusRef.current;
    const behavior = getHomeSceneBehavior(status);

    if (petBody) {
      petBody.setFillStyle(getPetTint(status));
    }

    if (petContainer && petLabel) {
      petLabel.setPosition(petContainer.x, petContainer.y - 42);
      petLabel.setText(refs.nameRef.current);
    }

    if (moodText) {
      moodText.setText(`当前心情：${status?.mood ?? "normal"}`);
    }

    if (behaviorText) {
      behaviorText.setText(`行为状态：${behavior.label}`);
    }
  };

  const drawBackground = () => {
    const graphics = scene.add.graphics();
    graphics.fillGradientStyle(0xfffbeb, 0xfff7ed, 0xfffbeb, 0xfef3c7, 1);
    graphics.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    graphics.lineStyle(1, 0xe7dcc7, 0.8);

    for (let index = 0; index <= GRID_SIZE; index += 1) {
      const lineOffset = index * TILE_SIZE;
      graphics.lineBetween(lineOffset, 0, lineOffset, SCENE_HEIGHT);
      graphics.lineBetween(0, lineOffset, SCENE_WIDTH, lineOffset);
    }
  };

  const drawRooms = () => {
    const roomConfigs = [
      {
        x: TILE_SIZE,
        y: TILE_SIZE,
        width: TILE_SIZE * 8,
        height: TILE_SIZE * 8,
        color: 0xfef3c7,
        label: "客厅",
      },
      {
        x: TILE_SIZE * 10,
        y: TILE_SIZE,
        width: TILE_SIZE * 8,
        height: TILE_SIZE * 6,
        color: 0xdbeafe,
        label: "厨房",
      },
      {
        x: TILE_SIZE * 10,
        y: TILE_SIZE * 10,
        width: TILE_SIZE * 8,
        height: TILE_SIZE * 7,
        color: 0xe9d5ff,
        label: "卧室",
      },
    ];

    roomConfigs.forEach((room) => {
      const roomRect = scene.add.rectangle(
        room.x + room.width / 2,
        room.y + room.height / 2,
        room.width,
        room.height,
        room.color,
        0.8
      );
      roomRect.setStrokeStyle(2, 0xffffff, 0.9);

      scene.add
        .text(room.x + 12, room.y + 10, room.label, {
          color: "#7c5b2d",
          fontSize: "16px",
          fontStyle: "bold",
        })
        .setDepth(3);
    });
  };

  const drawFixedObjects = () => {
    (
      Object.entries(HOME_SCENE_OBJECTS) as Array<
        [HomeSceneObjectAction, HomeSceneObjectMeta]
      >
    ).forEach(([action, spot]) => {
      const { x, y } = toWorld(spot.tileX, spot.tileY);
      const container = scene.add.container(x, y);
      const base = scene.add.rectangle(0, 0, 64, 48, spot.color, 0.95);
      base.setStrokeStyle(
        3,
        spot.interactionKind === "instant" ? 0xffffff : 0xe9d5ff,
        0.95
      );

      const label = scene.add.text(0, -7, spot.label, {
        color: "#1f2937",
        fontSize: "14px",
        fontStyle: "bold",
      });
      label.setOrigin(0.5);

      const hint = scene.add.text(0, 10, spot.badgeLabel, {
        color: spot.interactionKind === "instant" ? "#9a3412" : "#6b21a8",
        fontSize: "10px",
        fontStyle: "bold",
      });
      hint.setOrigin(0.5);

      container.add([base, label, hint]);
      container.setDepth(4);
      container.setSize(64, 48);
      container.setInteractive(
        new PhaserRuntime.Geom.Rectangle(-32, -24, 64, 48),
        PhaserRuntime.Geom.Rectangle.Contains
      );
      container.on("pointerdown", () => refs.actionRef.current(action));
    });
  };

  const createPet = () => {
    const startPoint = toWorld(7, 8);
    const shadow = scene.add.ellipse(0, 20, 34, 12, 0x7c5b2d, 0.18);
    const body = scene.add.circle(0, 0, 18, getPetTint(refs.statusRef.current));
    const leftEar = scene.add.triangle(-10, -16, 0, 0, 8, -16, 16, 0, 0xeab308);
    const rightEar = scene.add.triangle(10, -16, 0, 0, 8, -16, 16, 0, 0xeab308);
    const face = scene.add.text(0, -1, "^.^", {
      color: "#1f2937",
      fontSize: "12px",
    });
    face.setOrigin(0.5);

    petContainer = scene.add.container(startPoint.x, startPoint.y, [
      shadow,
      leftEar,
      rightEar,
      body,
      face,
    ]);
    petContainer.setDepth(7);
    petContainer.setSize(64, 64);
    petContainer.setInteractive(
      new PhaserRuntime.Geom.Circle(0, 0, 28),
      PhaserRuntime.Geom.Circle.Contains
    );
    petContainer.on("pointerdown", () => refs.actionRef.current("pet"));

    petBody = body;
    petLabel = scene.add.text(startPoint.x, startPoint.y - 42, refs.nameRef.current, {
      color: "#7c2d12",
      fontSize: "16px",
      fontStyle: "bold",
      backgroundColor: "#fff7ed",
      padding: { x: 8, y: 4 },
    });
    petLabel.setOrigin(0.5);
    petLabel.setDepth(8);

    moodText = scene.add.text(20, SCENE_HEIGHT - 56, "", {
      color: "#6b4f2c",
      fontSize: "15px",
      fontStyle: "bold",
    });
    moodText.setDepth(8);

    behaviorText = scene.add.text(20, SCENE_HEIGHT - 32, "", {
      color: "#7c5b2d",
      fontSize: "14px",
    });
    behaviorText.setDepth(8);
  };

  const movePet = () => {
    if (!petContainer || !petLabel) {
      return;
    }

    const behavior = getHomeSceneBehavior(refs.statusRef.current);
    const targetSpot =
      behavior.state === "idle"
        ? IDLE_POINTS[idleIndex % IDLE_POINTS.length]
        : HOME_SCENE_OBJECTS[behavior.target];

    if (behavior.state === "idle") {
      idleIndex += 1;
    }

    const targetPoint = toWorld(targetSpot.tileX, targetSpot.tileY);

    scene.tweens.add({
      targets: petContainer,
      x: targetPoint.x,
      y: targetPoint.y,
      duration: 1300,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: petLabel,
      x: targetPoint.x,
      y: targetPoint.y - 42,
      duration: 1300,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: petContainer,
      scaleX: 1.04,
      scaleY: 0.96,
      yoyo: true,
      duration: 350,
      repeat: 1,
    });

    refreshStatus();
  };

  scene.create = () => {
    drawBackground();
    drawRooms();
    drawFixedObjects();
    createPet();
    refreshStatus();

    scene.time.addEvent({
      delay: 2300,
      loop: true,
      callback: movePet,
    });

    refs.apiRef.current = { refresh: refreshStatus };

    scene.events.once("shutdown", () => {
      refs.apiRef.current = null;
    });
  };

  return scene;
}

export function PetHomeScene({
  petName,
  petStatus,
  onAction,
}: PetHomeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestStatusRef = useRef<PetStatus | null>(petStatus);
  const latestActionRef = useRef(onAction);
  const latestNameRef = useRef(petName);
  const sceneApiRef = useRef<{ refresh: () => void } | null>(null);

  latestStatusRef.current = petStatus;
  latestActionRef.current = onAction;
  latestNameRef.current = petName;

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
        statusRef: latestStatusRef,
        actionRef: latestActionRef,
        nameRef: latestNameRef,
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
  }, []);

  useEffect(() => {
    sceneApiRef.current?.refresh();
  }, [petName, petStatus]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-orange-200 bg-[#fff7ed] shadow-[0_20px_60px_-28px_rgba(194,120,3,0.45)]">
      <div ref={containerRef} className="aspect-square w-full bg-[#fff7ed]" />
    </div>
  );
}
