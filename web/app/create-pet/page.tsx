"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PetProfile = {
  petName: string;
  species: string;
  color: string;
  size: string;
  personality: string;
  specialTraits: string;
};

const PET_STORAGE_KEY = "pet-agent-social:pet-profile";

const isPetProfile = (value: unknown): value is PetProfile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pet = value as Record<string, unknown>;

  return (
    typeof pet.petName === "string" &&
    typeof pet.species === "string" &&
    typeof pet.color === "string" &&
    typeof pet.size === "string" &&
    typeof pet.personality === "string" &&
    typeof pet.specialTraits === "string"
  );
};

export default function CreatePetPage() {
  const [pet, setPet] = useState<PetProfile>({
    petName: "",
    species: "",
    color: "",
    size: "",
    personality: "",
    specialTraits: "",
  });
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      const savedPet = window.localStorage.getItem(PET_STORAGE_KEY);

      if (!savedPet) {
        return;
      }

      const parsedPet = JSON.parse(savedPet);

      if (isPetProfile(parsedPet)) {
        setPet(parsedPet);
        setFeedback({
          type: "info",
          message: `已为你加载上次保存的${parsedPet.petName || "宠物"}资料，可以直接继续编辑。`,
        });
      }
    } catch {
      setFeedback(null);
    }
  }, []);

  const handlePetChange = (field: keyof PetProfile, value: string) => {
    setPet((currentPet) => ({
      ...currentPet,
      [field]: value,
    }));
    setFeedback(null);
  };

  const handleSavePet = () => {
    try {
      window.localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(pet));
      setFeedback({
        type: "success",
        message: `已保存${pet.petName || "这只宠物"}的资料，现在可以去“我的宠物”页面查看。`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: "这次保存没有成功，请稍后再试一次。",
      });
    }
  };

  const petCardName = pet.petName || "未命名宠物";
  const petCardSpecies = pet.species || "待选择品种";
  const petCardColor = pet.color || "待补充颜色";
  const petCardSize = pet.size || "待选择体型";
  const petCardPersonality =
    pet.personality ||
    "这里会显示宠物的性格摘要，比如温柔、活泼、黏人，或者有一点自己的小脾气。";
  const petCardSpecialTraits =
    pet.specialTraits ||
    "这里会显示宠物的特殊特征，比如毛色细节、耳朵形状、尾巴特点，或者很容易被记住的小标记。";

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-gray-500 transition hover:text-gray-800"
          >
            ← 返回首页
          </Link>

          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">创建宠物</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            先为你的第一只宠物填写基础资料。现在这一版会实时读取你的输入，并在右侧显示预览。
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <form className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <label
                htmlFor="petName"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                宠物名字
              </label>
              <input
                id="petName"
                name="petName"
                type="text"
                value={pet.petName}
                onChange={(e) => handlePetChange("petName", e.target.value)}
                placeholder="例如：小泡芙"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="species"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                宠物品种
              </label>
              <select
                id="species"
                name="species"
                value={pet.species}
                onChange={(e) => handlePetChange("species", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              >
                <option value="">请选择一个品种</option>
                <option value="猫">猫</option>
                <option value="狗">狗</option>
                <option value="兔子">兔子</option>
                <option value="狐狸">狐狸</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="color"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                主颜色
              </label>
              <input
                id="color"
                name="color"
                type="text"
                value={pet.color}
                onChange={(e) => handlePetChange("color", e.target.value)}
                placeholder="例如：橘白、纯黑、奶油色"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="size"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                体型大小
              </label>
              <select
                id="size"
                name="size"
                value={pet.size}
                onChange={(e) => handlePetChange("size", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              >
                <option value="">请选择体型</option>
                <option value="小型">小型</option>
                <option value="中型">中型</option>
                <option value="大型">大型</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="personality"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                性格设定
              </label>
              <textarea
                id="personality"
                name="personality"
                rows={4}
                value={pet.personality}
                onChange={(e) => handlePetChange("personality", e.target.value)}
                placeholder="例如：很黏人，喜欢撒娇，看到新朋友会先观察一下。"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="specialTraits"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                特殊特征
              </label>
              <textarea
                id="specialTraits"
                name="specialTraits"
                rows={4}
                value={pet.specialTraits}
                onChange={(e) => handlePetChange("specialTraits", e.target.value)}
                placeholder="例如：左耳有一点卷，尾巴尖是白色，脖子上有一圈浅色毛。"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
              现在这个页面已经能读取你的输入了。下一步我们会让“保存宠物信息”按钮真正处理这些数据。
            </div>

            <div className="pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSavePet}
                  className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
                >
                  保存宠物信息
                </button>

                <Link
                  href="/my-pet"
                  className="text-sm text-gray-500 transition hover:text-gray-800"
                >
                  去查看我的宠物 →
                </Link>
              </div>

              {feedback ? (
                <div
                  className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${
                    feedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : feedback.type === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {feedback.message}
                </div>
              ) : null}
            </div>
          </form>

          <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  宠物资料预览
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  右侧会把你当前填写的内容整理成更像产品里的宠物资料卡片。
                </p>
              </div>

              <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm">
                实时同步
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-[0_20px_60px_-24px_rgba(180,83,9,0.35)]">
              <div className="bg-gradient-to-br from-orange-100 via-amber-50 to-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-lg font-semibold text-amber-700 shadow-sm ring-8 ring-white/70">
                      {pet.petName ? pet.petName.slice(0, 1) : "头像"}
                    </div>
                    <span className="mt-3 rounded-full bg-white/80 px-3 py-1 text-xs text-gray-500 shadow-sm">
                      头像占位
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-700">
                      宠物资料卡片
                    </p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                      {petCardName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      当前资料会根据左侧输入实时更新，方便你快速确认宠物设定是否完整。
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">品种</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {petCardSpecies}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">主颜色</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {petCardColor}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">体型</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {petCardSize}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">性格摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardPersonality}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">
                    特殊特征摘要
                  </p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardSpecialTraits}
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 p-4 text-sm leading-6 text-gray-600">
                  这张资料卡会随着你的输入继续完善。后续如果要接头像、标签或更多设定，也可以直接在这里继续扩展。
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
