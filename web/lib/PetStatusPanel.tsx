"use client";

import { useEffect, useState } from "react";
import { buildAuthHeaders } from "./auth";
import { API_BASE_URL } from "./constants";

type PetStatus = {
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
};

const MOOD_LABELS: Record<string, { label: string; className: string }> = {
  happy: { label: "开心", className: "bg-green-100 text-green-700 border-green-200" },
  normal: { label: "普通", className: "bg-gray-100 text-gray-600 border-gray-200" },
  sad: { label: "难过", className: "bg-blue-100 text-blue-700 border-blue-200" },
  uncomfortable: { label: "不舒服", className: "bg-red-100 text-red-700 border-red-200" },
};

const STAT_CONFIG = [
  { key: "fullness" as const, label: "饱食度", color: "bg-orange-400", icon: "🍖" },
  { key: "hydration" as const, label: "水分值", color: "bg-blue-400", icon: "💧" },
  { key: "affection" as const, label: "好感度", color: "bg-pink-400", icon: "💕" },
  { key: "energy" as const, label: "精力值", color: "bg-yellow-400", icon: "⚡" },
  { key: "cleanliness" as const, label: "清洁度", color: "bg-emerald-400", icon: "✨" },
];

const ACTIONS = [
  { endpoint: "feed", label: "喂食", icon: "🍖" },
  { endpoint: "drink", label: "喂水", icon: "💧" },
  { endpoint: "play", label: "玩耍", icon: "🎾" },
  { endpoint: "clean", label: "清洁", icon: "🛁" },
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
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
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

export function PetStatusPanel({ petId, authToken }: PetStatusPanelProps) {
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    const response = await fetch(`${API_BASE_URL}/pets/${petId}/status`, {
      cache: "no-store",
      headers: buildAuthHeaders(authToken),
    });

    if (!response.ok) return;

    const data = await response.json();
    setStatus(data);
  };

  useEffect(() => {
    fetchStatus();
  }, [petId, authToken]);

  const handleAction = async (endpoint: string, label: string) => {
    if (isActing) return;
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

      const data = await response.json();
      if (data.status) {
        setStatus(data.status);
      }
      setActionMessage(data.message || `${label}成功！`);
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
      <div className="flex items-center justify-between mb-4">
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
            onClick={() => handleAction(action.endpoint, action.label)}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.icon} {action.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <p className="mt-3 text-sm text-amber-700">{actionMessage}</p>
      )}
    </div>
  );
}
