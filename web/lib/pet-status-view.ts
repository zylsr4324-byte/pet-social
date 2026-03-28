import { getHomeSceneBehavior } from "./home-scene";
import type { PetStatus } from "./PetStatusPanel";

export type PetStatusViewState = "loading" | "ready" | "unavailable";

export type PetStatusEmptyState = {
  title: string;
  description: string;
};

export type HomeStatusDisplayPolicy = {
  showSummaryBadge: boolean;
  showSyncNotice: boolean;
};

export function getHomeStatusSummaryText(
  status: PetStatus | null,
  viewState: PetStatusViewState
): string {
  if (!status) {
    return viewState === "unavailable" ? "状态暂不可用" : "状态读取中";
  }

  return getHomeSceneBehavior(status).summary;
}

export function getHomeStatusDisplayPolicy(
  status: PetStatus | null,
  viewState: PetStatusViewState,
  isStatusPanelOpen: boolean
): HomeStatusDisplayPolicy {
  if (status) {
    return {
      showSummaryBadge: true,
      showSyncNotice: true,
    };
  }

  if (isStatusPanelOpen) {
    return {
      showSummaryBadge: false,
      showSyncNotice: false,
    };
  }

  return {
    showSummaryBadge:
      viewState === "loading" || viewState === "unavailable",
    showSyncNotice: false,
  };
}

export function getPetStatusEmptyState(
  viewState: PetStatusViewState
): PetStatusEmptyState {
  if (viewState === "unavailable") {
    return {
      title: "暂时拿不到状态",
      description: "页面会继续自动重试同步，你可以先浏览家庭场景，稍后再回来查看。",
    };
  }

  return {
    title: "正在读取状态",
    description: "页面正在读取宠物当前状态，请稍等一下。",
  };
}
