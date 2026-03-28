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
    text: "已选中宠物。右侧只负责状态查看和照料动作；聊天请使用独立聊天入口。",
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
