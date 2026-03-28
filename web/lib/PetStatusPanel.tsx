"use client";

import { useEffect, useState } from "react";

import { buildAuthHeaders } from "./auth";
import { API_BASE_URL } from "./constants";

export type PetStatus = {
  fullness: number;
  hydration: number;
  affection: number;
  energy: number;
  cleanliness: number;
  mood: string;
};

type PetStatusPanelProps = {
  petId: number;
  authToken: string;
  onStatusChange?: (status: PetStatus) => void;
};

const MOOD_LABELS: Record<string, { label: string; className: string }> = {
  happy: {
    label: "开心",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  normal: {
    label: "普通",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  sad: {
    label: "难过",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  uncomfortable: {
    label: "不舒服",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

const STAT_CONFIG = [
  { key: "fullness" as const, label: "饱食度", color: "bg-orange-400", icon: "🍖" },
  { key: "hydration" as const, label: "水分值", color: "bg-blue-400", icon: "💧" },
  { key: "affection" as const, label: "好感度", color: "bg-pink-400", icon: "💗" },
  { key: "energy" as const, label: "精力值", color: "bg-yellow-400", icon: "⚡" },
  { key: "cleanliness" as const, label: "清洁度", color: "bg-emerald-400", icon: "✨" },
];

const ACTIONS = [
  { endpoint: "feed", label: "喂食", icon: "🍖" },
  { endpoint: "drink", label: "喂水", icon: "💧" },
  { endpoint: "play", label: "玩耍", icon: "🧶" },
  { endpoint: "clean", label: "清洁", icon: "🧼" },
];

function StatBar({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 text-center">{icon}</span>
      <span className="w-16 text-sm text-gray-600">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-medium text-gray-700">
        {value}
      </span>
    </div>
  );
}

export function isPetStatus(value: unknown): value is PetStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = value as Record<string, unknown>;
  return (
    typeof status.fullness === "number" &&
    typeof status.hydration === "number" &&
    typeof status.affection === "number" &&
    typeof status.energy === "number" &&
    typeof status.cleanliness === "number" &&
    typeof status.mood === "string"
  );
}

export function PetStatusPanel({
  petId,
  authToken,
  onStatusChange,
}: PetStatusPanelProps) {
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const syncStatus = (nextStatus: PetStatus) => {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  };

  const fetchStatus = async () => {
    const response = await fetch(`${API_BASE_URL}/pets/${petId}/status`, {
      cache: "no-store",
      headers: buildAuthHeaders(authToken),
    });

    if (!response.ok) {
      return;
    }

    const data: unknown = await response.json();
    if (isPetStatus(data)) {
      syncStatus(data);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, [petId, authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (endpoint: string, label: string) => {
    if (isActing) {
      return;
    }

    setIsActing(true);
    setActionMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${petId}/${endpoint}`, {
        method: "POST",
        headers: buildAuthHeaders(authToken),
      });

      if (!response.ok) {
        setActionMessage(`${label}失败了，请稍后再试。`);
        return;
      }

      const data: unknown = await response.json();

      if (
        data &&
        typeof data === "object" &&
        "status" in data &&
        isPetStatus((data as { status?: unknown }).status)
      ) {
        syncStatus((data as { status: PetStatus }).status);
      }

      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message?: unknown }).message === "string"
      ) {
        setActionMessage((data as { message: string }).message);
      } else {
        setActionMessage(`${label}成功。`);
      }
    } catch {
      setActionMessage(`${label}失败了，请检查网络连接。`);
    } finally {
      setIsActing(false);
    }
  };

  if (!status) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <p className="text-sm text-gray-500">正在读取宠物状态...</p>
      </div>
    );
  }

  const moodInfo = MOOD_LABELS[status.mood] || MOOD_LABELS.normal;

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">宠物状态</h3>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${moodInfo.className}`}
        >
          {moodInfo.label}
        </span>
      </div>

      <div className="space-y-3">
        {STAT_CONFIG.map((stat) => (
          <StatBar
            key={stat.key}
            label={stat.label}
            value={status[stat.key]}
            color={stat.color}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {ACTIONS.map((action) => (
          <button
            key={action.endpoint}
            onClick={() => void handleAction(action.endpoint, action.label)}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {actionMessage ? (
        <p className="mt-3 text-sm text-amber-700">{actionMessage}</p>
      ) : null}
    </div>
  );
}
