import {
  buildHomeSceneActionMessage,
  HOME_SCENE_OBJECTS,
  type HomeSceneObjectAction,
} from "./home-scene";

export type HomePageNotice = {
  scope: "page";
  tone: "info" | "error";
  text: string;
};

export type HomeSceneNotice = {
  scope: "scene";
  tone: "info" | "success" | "error";
  text: string;
};

export type StatusPanelNotice = {
  scope: "panel";
  tone: "success" | "error";
  text: string;
};

export type HomeStatusSyncNotice = {
  scope: "sync";
  tone: "warning";
  text: string;
};

export type HomeNoticeScope =
  | HomePageNotice["scope"]
  | HomeSceneNotice["scope"]
  | StatusPanelNotice["scope"]
  | HomeStatusSyncNotice["scope"];

function normalizeNoticeText(text?: string | null) {
  const normalizedText = text?.trim();
  return normalizedText ? normalizedText : null;
}

export function createHomePageNotice(
  text: string,
  tone: HomePageNotice["tone"] = "error"
): HomePageNotice {
  return {
    scope: "page",
    tone,
    text,
  };
}

export function createPetSelectionSceneNotice(): HomeSceneNotice {
  return {
    scope: "scene",
    tone: "info",
    text: "已选中宠物。右侧会弹出互动菜单，你可以选择查看状态，或直接打开场景内聊天窗口。",
  };
}

export function createSceneTargetNotice(
  action: HomeSceneObjectAction
): HomeSceneNotice {
  return {
    scope: "scene",
    tone: "info",
    text: buildHomeSceneActionMessage(action),
  };
}

export function createSceneActionSuccessNotice(
  action: HomeSceneObjectAction,
  detail?: string | null
): HomeSceneNotice {
  return {
    scope: "scene",
    tone: "success",
    text: buildHomeSceneActionMessage(action, detail),
  };
}

export function createSceneActionErrorNotice(
  action: HomeSceneObjectAction,
  detail?: string | null
): HomeSceneNotice {
  return {
    scope: "scene",
    tone: "error",
    text:
      normalizeNoticeText(detail) ??
      `${HOME_SCENE_OBJECTS[action].label}互动失败，请稍后再试。`,
  };
}

export function createSceneActionNetworkNotice(
  action: HomeSceneObjectAction
): HomeSceneNotice {
  return {
    scope: "scene",
    tone: "error",
    text: `${HOME_SCENE_OBJECTS[action].label}互动失败，请检查网络连接。`,
  };
}

export function getHomeSceneNoticeClassName(
  tone: HomeSceneNotice["tone"]
): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export function createStatusPanelSuccessNotice(
  label: string,
  detail?: string | null
): StatusPanelNotice {
  return {
    scope: "panel",
    tone: "success",
    text: normalizeNoticeText(detail) ?? `${label}成功。`,
  };
}

export function createStatusPanelErrorNotice(
  label: string,
  detail?: string | null
): StatusPanelNotice {
  return {
    scope: "panel",
    tone: "error",
    text: normalizeNoticeText(detail) ?? `${label}失败了，请稍后再试。`,
  };
}

export function createStatusPanelNetworkNotice(
  label: string
): StatusPanelNotice {
  return {
    scope: "panel",
    tone: "error",
    text: `${label}失败了，请检查网络连接。`,
  };
}

export function getStatusPanelNoticeClassName(
  tone: StatusPanelNotice["tone"]
): string {
  return tone === "success" ? "text-emerald-700" : "text-rose-700";
}

export function createHomeStatusSyncNotice(): HomeStatusSyncNotice {
  return {
    scope: "sync",
    tone: "warning",
    text: "状态同步暂时失败，当前显示的数值可能不是最新。",
  };
}

export function getHomeStatusSyncNoticeClassName(
  tone: HomeStatusSyncNotice["tone"]
): string {
  return tone === "warning"
    ? "border-amber-200 bg-amber-50/80 text-amber-800"
    : "border-amber-200 bg-amber-50/80 text-amber-800";
}

function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function buildHomeStatusFreshnessText(
  lastSyncedAt: number,
  now: number = Date.now()
): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - lastSyncedAt) / 1000));
  let relativeText = "刚刚";

  if (elapsedSeconds >= 3600) {
    relativeText = `${Math.floor(elapsedSeconds / 3600)} 小时前`;
  } else if (elapsedSeconds >= 60) {
    relativeText = `${Math.floor(elapsedSeconds / 60)} 分钟前`;
  } else if (elapsedSeconds >= 15) {
    relativeText = `${elapsedSeconds} 秒前`;
  }

  return `最近一次同步：${relativeText}（${formatClockTime(lastSyncedAt)}）`;
}

export function getNoticeAutoDismissMs(
  scope: HomeNoticeScope
): number | null {
  switch (scope) {
    case "scene":
      return 4200;
    case "panel":
      return 3200;
    default:
      return null;
  }
}
