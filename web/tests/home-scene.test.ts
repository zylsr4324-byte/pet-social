import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildHomeSceneActionMessage,
  getHomePetSpriteSpec,
  getHomeSceneBehavior,
  getRoomConfig,
  HOME_SCENE_ROOMS,
  HOME_PET_INTERACTION_MENU_ITEMS,
  HOME_SCENE_OBJECTS,
} from "../lib/home-scene";
import {
  buildHomeStatusFreshnessText,
  createHomePageNotice,
  createHomeStatusSyncNotice,
  createPetSelectionSceneNotice,
  createSceneActionErrorNotice,
  createSceneActionSuccessNotice,
  createSceneTargetNotice,
  createStatusPanelErrorNotice,
  createStatusPanelSuccessNotice,
  getNoticeAutoDismissMs,
} from "../lib/home-scene-notice";
import { PetStatusPanel, type PetStatus } from "../lib/PetStatusPanel";
import {
  getHomeStatusDisplayPolicy,
  getHomeStatusSummaryText,
  getPetStatusEmptyState,
} from "../lib/pet-status-view";

function createStatus(overrides: Partial<PetStatus> = {}): PetStatus {
  return {
    fullness: 80,
    hydration: 80,
    affection: 60,
    energy: 80,
    cleanliness: 80,
    mood: "normal",
    ...overrides,
  };
}

function runTest(name: string, assertion: () => void) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("getHomeSceneBehavior handles missing status without crashing", () => {
  const behavior = getHomeSceneBehavior(null);

  assert.equal(behavior.state, "wandering");
  assert.equal(behavior.target, null);
  assert.equal(behavior.summary, "\u72b6\u6001\u8bfb\u53d6\u4e2d");
});

runTest("getHomeSceneBehavior keeps the intended priority order", () => {
  assert.equal(
    getHomeSceneBehavior(createStatus({ fullness: 10, hydration: 10, energy: 5 })).state,
    "seeking_food"
  );
  assert.equal(
    getHomeSceneBehavior(createStatus({ fullness: 45, hydration: 10, energy: 5 })).state,
    "seeking_water"
  );
  assert.equal(
    getHomeSceneBehavior(createStatus({ fullness: 45, hydration: 45, energy: 5 })).state,
    "sleeping"
  );
  assert.equal(
    getHomeSceneBehavior(createStatus({ fullness: 45, hydration: 45, energy: 20 })).state,
    "seeking_rest"
  );
});

runTest("getHomeSceneBehavior uses room context for grooming, play, and social", () => {
  const grooming = getHomeSceneBehavior(
    createStatus({ cleanliness: 20, affection: 40 }),
    { hasToy: true, hasOtherPets: true }
  );
  const playing = getHomeSceneBehavior(createStatus({ affection: 40 }), {
    hasToy: true,
  });
  const social = getHomeSceneBehavior(createStatus(), {
    hasOtherPets: true,
  });
  const wandering = getHomeSceneBehavior(createStatus());

  assert.equal(grooming.state, "grooming");
  assert.equal(grooming.target, null);
  assert.equal(playing.state, "playing");
  assert.equal(playing.target, "play");
  assert.equal(social.state, "social");
  assert.equal(social.target, null);
  assert.equal(wandering.state, "wandering");
  assert.equal(wandering.target, null);
});

runTest("HOME_SCENE_OBJECTS separates instant actions from target points", () => {
  const instantEntries = Object.entries(HOME_SCENE_OBJECTS)
    .filter(([, item]) => item.interactionKind === "instant")
    .map(([action]) => action);
  const targetEntries = Object.entries(HOME_SCENE_OBJECTS)
    .filter(([, item]) => item.interactionKind === "target")
    .map(([action]) => action);

  assert.deepEqual(instantEntries, ["feed", "drink", "play"]);
  assert.deepEqual(targetEntries, ["bed"]);
  assert.equal(HOME_SCENE_OBJECTS.bed.badgeLabel, "休息目标");
});

runTest("HOME_SCENE_ROOMS keeps the redesigned room order and metadata", () => {
  assert.deepEqual(
    HOME_SCENE_ROOMS.map((room) => room.id),
    ["living", "bedroom", "kitchen"]
  );
  assert.equal(getRoomConfig("living").label, "客厅");
  assert.equal(getRoomConfig("bedroom").floorStyle, "carpet");
  assert.equal(getRoomConfig("kitchen").floorStyle, "tile");
  assert.equal(HOME_SCENE_OBJECTS.feed.room, "kitchen");
  assert.equal(HOME_SCENE_OBJECTS.play.room, "living");
  assert.equal(HOME_SCENE_OBJECTS.bed.room, "bedroom");
});

runTest("home scene pet sprite changes by species", () => {
  assert.deepEqual(getHomePetSpriteSpec("猫"), {
    speciesLabel: "猫系轮廓",
    face: "^.^",
    bodyWidth: 36,
    bodyHeight: 36,
    earStyle: "pointed",
    tailStyle: "short",
  });
  assert.deepEqual(getHomePetSpriteSpec("狗"), {
    speciesLabel: "狗系轮廓",
    face: "u.u",
    bodyWidth: 42,
    bodyHeight: 34,
    earStyle: "floppy",
    tailStyle: "curled",
  });
  assert.deepEqual(getHomePetSpriteSpec("兔子"), {
    speciesLabel: "兔系轮廓",
    face: "•ᴗ•",
    bodyWidth: 32,
    bodyHeight: 38,
    earStyle: "long",
    tailStyle: "cotton",
  });
});

runTest("pet interaction menu keeps status view and chat entry separate", () => {
  assert.deepEqual(
    HOME_PET_INTERACTION_MENU_ITEMS.map((item) => item.action),
    ["status", "chat"]
  );
  assert.equal(HOME_PET_INTERACTION_MENU_ITEMS[0]?.label, "查看状态面板");
  assert.equal(HOME_PET_INTERACTION_MENU_ITEMS[1]?.label, "打开聊天窗口");
  assert.equal(
    HOME_PET_INTERACTION_MENU_ITEMS[1]?.description,
    "直接在家庭场景里展开聊天窗口，不再跳转到独立聊天页面。"
  );
});

runTest("HOME_SCENE_OBJECTS keeps fixed objects on unique tiles", () => {
  const tileKeys = Object.values(HOME_SCENE_OBJECTS).map(
    (item) => `${item.tileX}:${item.tileY}`
  );
  const uniqueTiles = new Set(tileKeys);

  assert.equal(uniqueTiles.size, tileKeys.length);
});

runTest("buildHomeSceneActionMessage falls back when backend detail is absent", () => {
  assert.equal(
    buildHomeSceneActionMessage("bed"),
    "床当前只作为休息目标点，不会立即写入数值。"
  );
  assert.equal(buildHomeSceneActionMessage("feed", "已喂食。"), "已喂食。");
});

runTest("home scene notices keep page, scene, and panel responsibilities separate", () => {
  const pageNotice = createHomePageNotice("请先登录。", "info");
  const statusSyncNotice = createHomeStatusSyncNotice();
  const freshSyncText = buildHomeStatusFreshnessText(
    new Date("2026-03-29T09:30:00").getTime(),
    new Date("2026-03-29T09:30:10").getTime()
  );
  const minuteSyncText = buildHomeStatusFreshnessText(
    new Date("2026-03-29T09:25:00").getTime(),
    new Date("2026-03-29T09:30:10").getTime()
  );
  const petSceneNotice = createPetSelectionSceneNotice();
  const bedSceneNotice = createSceneTargetNotice("bed");
  const sceneSuccessNotice = createSceneActionSuccessNotice("feed", "已喂食。");
  const sceneErrorNotice = createSceneActionErrorNotice("feed");
  const panelSuccessNotice = createStatusPanelSuccessNotice("喂食");
  const panelErrorNotice = createStatusPanelErrorNotice("喂食");

  assert.deepEqual(pageNotice, {
    scope: "page",
    tone: "info",
    text: "请先登录。",
  });
  assert.deepEqual(statusSyncNotice, {
    scope: "sync",
    tone: "warning",
    text: "状态同步暂时失败，当前显示的数值可能不是最新。",
  });
  assert.equal(freshSyncText, "最近一次同步：刚刚（09:30:00）");
  assert.equal(minuteSyncText, "最近一次同步：5 分钟前（09:25:00）");
  assert.equal(petSceneNotice.scope, "scene");
  assert.equal(petSceneNotice.tone, "info");
  assert.equal(
    petSceneNotice.text,
    "已选中宠物。右侧会弹出互动菜单，你可以选择查看状态，或直接打开场景内聊天窗口。"
  );
  assert.equal(bedSceneNotice.scope, "scene");
  assert.equal(bedSceneNotice.tone, "info");
  assert.equal(
    bedSceneNotice.text,
    "床当前只作为休息目标点，不会立即写入数值。"
  );
  assert.deepEqual(sceneSuccessNotice, {
    scope: "scene",
    tone: "success",
    text: "已喂食。",
  });
  assert.deepEqual(sceneErrorNotice, {
    scope: "scene",
    tone: "error",
    text: "食盆互动失败，请稍后再试。",
  });
  assert.deepEqual(panelSuccessNotice, {
    scope: "panel",
    tone: "success",
    text: "喂食成功。",
  });
  assert.deepEqual(panelErrorNotice, {
    scope: "panel",
    tone: "error",
    text: "喂食失败了，请稍后再试。",
  });
  assert.equal(getNoticeAutoDismissMs("page"), null);
  assert.equal(getNoticeAutoDismissMs("sync"), null);
  assert.equal(getNoticeAutoDismissMs("scene"), 4200);
  assert.equal(getNoticeAutoDismissMs("panel"), 3200);
});

runTest("pet status view distinguishes loading and unavailable empty states", () => {
  assert.equal(getHomeStatusSummaryText(null, "loading"), "状态读取中");
  assert.equal(getHomeStatusSummaryText(null, "unavailable"), "状态暂不可用");
  assert.equal(
    getHomeStatusSummaryText(createStatus(), "ready"),
    "Wandering\uFF1A\u5BA0\u7269\u4F1A\u5728\u623F\u95F4\u91CC\u6CBF\u8DEF\u5F84\u968F\u673A\u6E38\u8D70"
  );
  assert.deepEqual(getHomeStatusDisplayPolicy(createStatus(), "ready", false), {
    showSummaryBadge: true,
    showSyncNotice: true,
  });
  assert.deepEqual(getHomeStatusDisplayPolicy(null, "loading", false), {
    showSummaryBadge: true,
    showSyncNotice: false,
  });
  assert.deepEqual(getHomeStatusDisplayPolicy(null, "unavailable", true), {
    showSummaryBadge: false,
    showSyncNotice: false,
  });

  assert.deepEqual(getPetStatusEmptyState("loading"), {
    title: "正在读取状态",
    description: "页面正在读取宠物当前状态，请稍等一下。",
  });
  assert.deepEqual(getPetStatusEmptyState("unavailable"), {
    title: "暂时拿不到状态",
    description: "页面会继续自动重试同步，你可以先浏览家庭场景，稍后再回来查看。",
  });
});

runTest("PetStatusPanel follows the parent-owned status snapshot", () => {
  const firstMarkup = renderToStaticMarkup(
    createElement(PetStatusPanel, {
      petId: 1,
      authToken: "token",
      status: createStatus({
        fullness: 11,
        hydration: 22,
        affection: 33,
        energy: 44,
        cleanliness: 55,
      }),
      statusViewState: "ready",
    })
  );

  const secondMarkup = renderToStaticMarkup(
    createElement(PetStatusPanel, {
      petId: 1,
      authToken: "token",
      status: createStatus({
        fullness: 66,
        hydration: 77,
        affection: 88,
        energy: 99,
        cleanliness: 12,
      }),
      statusViewState: "ready",
    })
  );

  assert.match(firstMarkup, />11</);
  assert.match(firstMarkup, />22</);
  assert.match(secondMarkup, />66</);
  assert.match(secondMarkup, />77</);
  assert.doesNotMatch(secondMarkup, />11</);
  assert.doesNotMatch(secondMarkup, />22</);
});

runTest("PetStatusPanel shows degraded empty copy when status is unavailable", () => {
  const unavailableMarkup = renderToStaticMarkup(
    createElement(PetStatusPanel, {
      petId: 1,
      authToken: "token",
      status: null,
      statusViewState: "unavailable",
    })
  );

  assert.match(unavailableMarkup, /暂时拿不到状态/);
  assert.match(unavailableMarkup, /会继续自动重试同步/);
});

console.log("Home scene regression checks passed.");
