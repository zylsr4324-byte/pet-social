"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { readStoredAuthToken } from "../../../lib/auth";
import {
  CATEGORY_LABELS,
  SPRITE_EMOJI,
  fetchFurnitureTemplates,
  fetchPlacedFurniture,
  placeFurniture,
  removeFurniture,
  type FurnitureTemplate,
  type PlacedFurniture,
} from "../../../lib/furniture";
import { recoverLatestPetForCurrentUser, type ApiPet } from "../../../lib/pet";
import { AppHeaderNav } from "../../../lib/AppHeaderNav";
import { ui } from "../../../lib/ui";

const GRID_SIZE = 20;

export default function FurniturePage() {
  const router = useRouter();
  const [pet, setPet] = useState<ApiPet | null>(null);
  const [templates, setTemplates] = useState<FurnitureTemplate[]>([]);
  const [placed, setPlaced] = useState<PlacedFurniture[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<FurnitureTemplate | null>(null);
  const [placing, setPlacing] = useState(false);
  const [tileX, setTileX] = useState(0);
  const [tileY, setTileY] = useState(0);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  useEffect(() => {
    const token = readStoredAuthToken();
    if (!token) {
      router.replace("/?next=/home/furniture");
      return;
    }

    const loadPage = async () => {
      try {
        const { pet: currentPet, unauthorized } =
          await recoverLatestPetForCurrentUser(token, "家具页面加载失败。");

        if (unauthorized || !currentPet) {
          router.replace("/?next=/home/furniture");
          return;
        }

        setPet(currentPet);
        const [templateList, placedList] = await Promise.all([
          fetchFurnitureTemplates(),
          fetchPlacedFurniture(currentPet.id, token),
        ]);
        setTemplates(templateList);
        setPlaced(placedList);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "加载失败。");
      }
    };

    void loadPage();
  }, [router]);

  const handlePlace = async () => {
    const token = readStoredAuthToken();
    if (!token || !pet || !selectedTemplate) {
      return;
    }

    if (tileX < 0 || tileX >= GRID_SIZE || tileY < 0 || tileY >= GRID_SIZE) {
      setError("坐标超出范围。");
      return;
    }

    setPlacing(true);
    try {
      const item = await placeFurniture(
        pet.id,
        token,
        selectedTemplate.id,
        tileX,
        tileY
      );
      setPlaced((current) => [...current, item]);
      showNotice(`已放置 ${selectedTemplate.name}`);
      setSelectedTemplate(null);
    } catch (placeError) {
      setError(placeError instanceof Error ? placeError.message : "放置失败。");
    } finally {
      setPlacing(false);
    }
  };

  const handleRemove = async (item: PlacedFurniture) => {
    const token = readStoredAuthToken();
    if (!token || !pet) {
      return;
    }

    try {
      await removeFurniture(pet.id, token, item.id);
      setPlaced((current) => current.filter((entry) => entry.id !== item.id));
      showNotice(`已移除 ${item.template.name}`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "移除失败。");
    }
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <Link href="/home" className="text-amber-700 underline">
          返回主页
        </Link>
      </main>
    );
  }

  const categories = Array.from(new Set(templates.map((template) => template.category)));

  return (
    <main className="min-h-screen bg-[#fff7ed] p-6">
      <div className="mx-auto max-w-2xl">
        <AppHeaderNav compact />
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-xl font-bold text-amber-900">家具编辑</h1>
          {pet ? (
            <span className="text-sm text-amber-600">{pet.petName}</span>
          ) : null}
        </div>

        {notice ? (
          <div className={`mb-4 ${ui.noticeSuccess}`}>
            {notice}
          </div>
        ) : null}

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">
            已放置
          </h2>
          {placed.length === 0 ? (
            <p className="text-sm text-amber-500">还没有放置家具。</p>
          ) : (
            <ul className="space-y-2">
              {placed.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center justify-between ${ui.cardSoft} bg-white px-4 py-3 shadow-sm`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {SPRITE_EMOJI[item.template.sprite_key] ?? "?"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-amber-900">
                        {item.template.name}
                      </p>
                      <p className="text-xs text-amber-500">
                        ({item.tile_x}, {item.tile_y}) ·{" "}
                        {CATEGORY_LABELS[item.template.category] ??
                          item.template.category}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    className="inline-flex items-center justify-center rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-200"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">模板</h2>
          {categories.map((category) => (
            <div key={category} className="mb-4">
              <p className="mb-1 text-xs text-amber-500">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {templates
                  .filter((template) => template.category === category)
                  .map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() =>
                        setSelectedTemplate((current) =>
                          current?.id === template.id ? null : template
                        )
                      }
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                        selectedTemplate?.id === template.id
                          ? "border-amber-400 bg-amber-50 shadow"
                          : "border-orange-100 bg-white hover:border-amber-300"
                      }`}
                    >
                      <span className="text-2xl">
                        {SPRITE_EMOJI[template.sprite_key] ?? "?"}
                      </span>
                      <span className="text-xs leading-tight text-amber-800">
                        {template.name}
                      </span>
                      <span className="text-[10px] text-amber-400">
                        {template.width}x{template.height}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>

        {selectedTemplate ? (
          <section className={`${ui.card} p-4`}>
            <h2 className="mb-3 text-sm font-semibold text-amber-800">
              放置 {selectedTemplate.name}
            </h2>
            <div className="mb-4 flex gap-4">
              <label className="flex flex-col gap-1 text-xs text-amber-700">
                X
                <input
                  type="number"
                  min={0}
                  max={GRID_SIZE - selectedTemplate.width}
                  value={tileX}
                  onChange={(event) => setTileX(Number(event.target.value))}
                  className="w-20 rounded-lg border border-orange-200 bg-[#faf6ef] px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-amber-700">
                Y
                <input
                  type="number"
                  min={0}
                  max={GRID_SIZE - selectedTemplate.height}
                  value={tileY}
                  onChange={(event) => setTileY(Number(event.target.value))}
                  className="w-20 rounded-lg border border-orange-200 bg-[#faf6ef] px-2 py-1 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePlace}
                disabled={placing}
                className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {placing ? "放置中..." : "确认放置"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="rounded-xl border border-orange-200 px-4 py-2 text-sm text-amber-700 transition hover:bg-orange-50"
              >
                取消
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
