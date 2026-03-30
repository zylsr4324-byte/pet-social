"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buildAuthHeaders, readStoredAuthToken } from "../../../lib/auth";
import { API_BASE_URL, LOGIN_REQUIRED_MESSAGE } from "../../../lib/constants";
import {
  readStoredPetId,
  recoverLatestPetForCurrentUser,
  type ApiPet,
} from "../../../lib/pet";
import {
  type FurnitureTemplate,
  type PlacedFurniture,
  fetchFurnitureTemplates,
  fetchPlacedFurniture,
  placeFurniture,
  removeFurniture,
  CATEGORY_LABELS,
  SPRITE_EMOJI,
} from "../../../lib/furniture";

const GRID_SIZE = 20;

export default function FurniturePage() {
  const [pet, setPet] = useState<ApiPet | null>(null);
  const [templates, setTemplates] = useState<FurnitureTemplate[]>([]);
  const [placed, setPlaced] = useState<PlacedFurniture[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FurnitureTemplate | null>(null);
  const [placing, setPlacing] = useState(false);
  const [tileX, setTileX] = useState(0);
  const [tileY, setTileY] = useState(0);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  useEffect(() => {
    const token = readStoredAuthToken();
    if (!token) {
      setError(LOGIN_REQUIRED_MESSAGE);
      return;
    }
    (async () => {
      try {
        const { pet: p, unauthorized } = await recoverLatestPetForCurrentUser(token, LOGIN_REQUIRED_MESSAGE);
        if (unauthorized || !p) {
          setError(LOGIN_REQUIRED_MESSAGE);
          return;
        }
        setPet(p);
        const [tmpl, pl] = await Promise.all([
          fetchFurnitureTemplates(),
          fetchPlacedFurniture(p.id, token),
        ]);
        setTemplates(tmpl);
        setPlaced(pl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
  }, []);

  const handlePlace = async () => {
    const token = readStoredAuthToken();
    if (!token || !pet || !selectedTemplate) return;
    if (tileX < 0 || tileX >= GRID_SIZE || tileY < 0 || tileY >= GRID_SIZE) {
      setError("坐标超出范围（0-19）");
      return;
    }
    setPlacing(true);
    try {
      const item = await placeFurniture(pet.id, token, selectedTemplate.id, tileX, tileY);
      setPlaced((prev) => [...prev, item]);
      showNotice(`已放置「${selectedTemplate.name}」`);
      setSelectedTemplate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "放置失败");
    } finally {
      setPlacing(false);
    }
  };

  const handleRemove = async (item: PlacedFurniture) => {
    const token = readStoredAuthToken();
    if (!token || !pet) return;
    try {
      await removeFurniture(pet.id, token, item.id);
      setPlaced((prev) => prev.filter((p) => p.id !== item.id));
      showNotice(`已移除「${item.template.name}」`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "移除失败");
    }
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/login" className="text-amber-700 underline">前往登录</Link>
      </main>
    );
  }

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  return (
    <main className="min-h-screen bg-[#fff7ed] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/home" className="text-amber-700 hover:text-amber-900 text-sm">← 返回家庭场景</Link>
          <h1 className="text-xl font-bold text-amber-900">家具编辑</h1>
          {pet && <span className="text-sm text-amber-600">· {pet.petName} 的家</span>}
        </div>

        {/* Notice */}
        {notice && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            {notice}
          </div>
        )}

        {/* 已放置家具 */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">已放置的家具（{placed.length} 件）</h2>
          {placed.length === 0 ? (
            <p className="text-sm text-amber-500">还没有放置任何家具，从下方选择模板开始布置吧。</p>
          ) : (
            <ul className="space-y-2">
              {placed.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-white border border-orange-100 px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{SPRITE_EMOJI[item.template.sprite_key] ?? "📦"}</span>
                    <div>
                      <p className="font-medium text-amber-900 text-sm">{item.template.name}</p>
                      <p className="text-xs text-amber-500">位置 ({item.tile_x}, {item.tile_y}) · {CATEGORY_LABELS[item.template.category] ?? item.template.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(item)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 家具模板 */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">家具模板</h2>
          {categories.map((cat) => (
            <div key={cat} className="mb-4">
              <p className="text-xs text-amber-500 mb-1">{CATEGORY_LABELS[cat] ?? cat}</p>
              <div className="grid grid-cols-4 gap-2">
                {templates
                  .filter((t) => t.category === cat)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                        selectedTemplate?.id === t.id
                          ? "border-amber-400 bg-amber-50 shadow"
                          : "border-orange-100 bg-white hover:border-amber-300"
                      }`}
                    >
                      <span className="text-2xl">{SPRITE_EMOJI[t.sprite_key] ?? "📦"}</span>
                      <span className="text-xs text-amber-800 leading-tight">{t.name}</span>
                      <span className="text-[10px] text-amber-400">{t.width}×{t.height}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>

        {/* 放置面板 */}
        {selectedTemplate && (
          <section className="rounded-2xl bg-white border border-amber-200 p-4 shadow">
            <h2 className="text-sm font-semibold text-amber-800 mb-3">
              放置「{selectedTemplate.name}」
            </h2>
            <div className="flex gap-4 mb-4">
              <label className="flex flex-col gap-1 text-xs text-amber-700">
                列（X）
                <input
                  type="number"
                  min={0}
                  max={GRID_SIZE - selectedTemplate.width}
                  value={tileX}
                  onChange={(e) => setTileX(Number(e.target.value))}
                  className="w-20 rounded-lg border border-orange-200 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-amber-700">
                行（Y）
                <input
                  type="number"
                  min={0}
                  max={GRID_SIZE - selectedTemplate.height}
                  value={tileY}
                  onChange={(e) => setTileY(Number(e.target.value))}
                  className="w-20 rounded-lg border border-orange-200 px-2 py-1 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePlace}
                disabled={placing}
                className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
              >
                {placing ? "放置中…" : "确认放置"}
              </button>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="rounded-xl border border-orange-200 px-4 py-2 text-sm text-amber-700 hover:bg-orange-50 transition"
              >
                取消
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
