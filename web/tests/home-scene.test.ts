import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildHomeSceneActionMessage,
  getHomeSceneBehavior,
  HOME_SCENE_OBJECTS,
} from "../lib/home-scene";
import { PetStatusPanel, type PetStatus } from "../lib/PetStatusPanel";

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

  assert.equal(behavior.state, "idle");
  assert.equal(behavior.target, "feed");
  assert.equal(behavior.summary, "状态读取中");
});

runTest("getHomeSceneBehavior keeps the intended priority order", () => {
  assert.equal(
    getHomeSceneBehavior(createStatus({ fullness: 40, hydration: 10, energy: 10 }))
      .target,
    "feed"
  );
  assert.equal(getHomeSceneBehavior(createStatus({ hydration: 40 })).target, "drink");
  assert.equal(getHomeSceneBehavior(createStatus({ energy: 30 })).target, "bed");
  assert.equal(getHomeSceneBehavior(createStatus()).target, "play");
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
    })
  );

  assert.match(firstMarkup, />11</);
  assert.match(firstMarkup, />22</);
  assert.match(secondMarkup, />66</);
  assert.match(secondMarkup, />77</);
  assert.doesNotMatch(secondMarkup, />11</);
  assert.doesNotMatch(secondMarkup, />22</);
});

console.log("Home scene regression checks passed.");
