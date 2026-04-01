"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthSessionNotice } from "../../lib/AuthSessionNotice";
import { buildAuthHeaders, clearStoredAuth, readStoredAuthToken } from "../../lib/auth";
import { API_BASE_URL, LOGIN_REQUIRED_MESSAGE } from "../../lib/constants";
import {
  isPetListResponse,
  writeStoredPetId,
  clearStoredPetId,
  readStoredPetId,
  type ApiPet,
} from "../../lib/pet";

export default function MyPetsPage() {
  const [pets, setPets] = useState<ApiPet[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePetId, setActivePetId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPets = async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/pets`, {
      cache: "no-store",
      headers: buildAuthHeaders(token),
    });
    if (res.status === 401) {
      clearStoredAuth();
      setAuthToken(null);
      setFeedback({ type: "info", message: LOGIN_REQUIRED_MESSAGE });
      return;
    }
    if (!res.ok) {
      setFeedback({ type: "error", message: "加载宠物列表失败，请刷新重试。" });
      return;
    }
    const data: unknown = await res.json();
    if (isPetListResponse(data)) {
      setPets(data.pets);
    }
  };

  useEffect(() => {
    const token = readStoredAuthToken();
    const currentId = readStoredPetId();
    setActivePetId(currentId);
    if (!token) {
      setFeedback({ type: "info", message: LOGIN_REQUIRED_MESSAGE });
      setIsLoading(false);
      return;
    }
    setAuthToken(token);
    loadPets(token).finally(() => setIsLoading(false));
  }, []);

  const handleSetActive = (pet: ApiPet) => {
    writeStoredPetId(pet.id);
    setActivePetId(pet.id);
    setFeedback({ type: "success", message: `已切换到${pet.petName}，前往主页场景查看。` });
  };

  const handleDelete = async (pet: ApiPet) => {
    if (!authToken) return;
    if (!window.confirm(`确认删除宠物「${pet.petName}」？此操作不可撤销，聊天记录也会一并删除。`)) return;
    setDeletingId(pet.id);
    try {
      const res = await fetch(`${API_BASE_URL}/pets/${pet.id}`, {
        method: "DELETE",
        headers: buildAuthHeaders(authToken),
      });
      if (!res.ok && res.status !== 204) {
        setFeedback({ type: "error", message: "删除失败，请稍后重试。" });
        return;
      }
      // 如果删除的是当前激活宠物，清除存储
      if (activePetId === pet.id) {
        clearStoredPetId();
        setActivePetId(null);
      }
      setPets((prev) => prev.filter((p) => p.id !== pet.id));
      setFeedback({ type: "success", message: `${pet.petName} 已删除。` });
    } catch {
      setFeedback({ type: "error", message: "删除失败，请稍后重试。" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">返回首页</Link>
          <Link href="/home" className="transition hover:text-gray-800">家庭场景</Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-medium text-amber-700">宠物管理</p>
          <h1 className="mt-1 text-3xl font-bold">我的所有宠物</h1>
          <p className="mt-2 text-gray-500">管理你的宠物，切换当前激活宠物，或创建新宠物。</p>
        </div>

        <AuthSessionNotice authToken={authToken} className="mb-8" />

        {feedback && (
          <div className={`mb-6 rounded-2xl px-5 py-4 text-sm ${
            feedback.type === "success" ? "bg-green-50 text-green-800" :
            feedback.type === "error" ? "bg-red-50 text-red-800" :
            "bg-blue-50 text-blue-800"
          }`}>
            {feedback.message}
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-400">加载中…</p>
        ) : !authToken ? (
          <div className="rounded-2xl bg-amber-50 p-6 text-amber-800">
            <p>请先 <Link href="/login" className="underline">登录</Link> 后再管理宠物。</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <Link
                href="/create-pet?mode=new"
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                + 新建宠物
              </Link>
            </div>

            {pets.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
                <p className="mb-4">你还没有任何宠物。</p>
                <Link href="/create-pet?mode=new" className="text-amber-600 underline">创建第一只宠物</Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {pets.map((pet) => (
                  <div
                    key={pet.id}
                    className={`rounded-2xl border p-5 transition ${
                      activePetId === pet.id
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold">{pet.petName}</h2>
                          {activePetId === pet.id && (
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">当前激活</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {pet.species} · {pet.color} · {pet.size}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{pet.personality}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {activePetId !== pet.id && (
                          <button
                            onClick={() => handleSetActive(pet)}
                            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
                          >
                            切换激活
                          </button>
                        )}
                        <Link
                          href={`/create-pet?id=${pet.id}`}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
                        >
                          编辑
                        </Link>
                        <button
                          onClick={() => handleDelete(pet)}
                          disabled={deletingId === pet.id}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === pet.id ? "删除中…" : "删除"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
