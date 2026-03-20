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

export default function MyPetPage() {
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedPet = window.localStorage.getItem(PET_STORAGE_KEY);

      if (!savedPet) {
        setIsLoaded(true);
        return;
      }

      const parsedPet = JSON.parse(savedPet);

      if (isPetProfile(parsedPet)) {
        setPet(parsedPet);
      }
    } catch {
      setPet(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const petCardName = pet?.petName || "未命名宠物";
  const petCardSpecies = pet?.species || "待选择品种";
  const petCardColor = pet?.color || "待补充颜色";
  const petCardSize = pet?.size || "待选择体型";
  const petCardPersonality =
    pet?.personality ||
    "这里会显示宠物的性格摘要，比如温柔、活泼、黏人，或者有一点自己的小脾气。";
  const petCardSpecialTraits =
    pet?.specialTraits ||
    "这里会显示宠物的特殊特征，比如毛色细节、耳朵形状、尾巴特点，或者很容易被记住的小标记。";

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">
            ← 返回首页
          </Link>
          <Link href="/create-pet" className="transition hover:text-gray-800">
            去创建宠物
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">我的宠物</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            这里会展示你已经保存下来的宠物资料。
          </p>
        </div>

        {!isLoaded ? (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <p className="text-sm leading-6 text-gray-600">
              正在读取宠物资料，请稍等一下。
            </p>
          </section>
        ) : null}

        {isLoaded && !pet ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">
              你还没有创建宠物
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              先去创建你的第一只宠物吧。填写完成后保存，资料就会出现在这里。
            </p>

            <div className="mt-6">
              <Link
                href="/create-pet"
                className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                去创建宠物
              </Link>
            </div>
          </section>
        ) : null}

        {isLoaded && pet ? (
          <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  已保存的宠物资料
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  这是你当前保存在本地的宠物资料卡片。
                </p>
              </div>

              <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm">
                本地已保存
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
                      这些内容来自你上一次在创建页面手动保存的宠物资料。
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

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/create-pet"
                    className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
                  >
                    继续编辑宠物
                  </Link>

                  <p className="text-sm text-gray-500">
                    想更新资料的话，回到创建页面重新保存一次就可以。
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
