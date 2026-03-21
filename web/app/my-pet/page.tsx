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

const getSpeciesVisual = (species: string) => {
  switch (species) {
    case "猫":
      return { icon: "🐱", label: "猫系轮廓", note: "轻盈又灵巧" };
    case "狗":
      return { icon: "🐶", label: "狗系轮廓", note: "元气又亲近" };
    case "兔子":
      return { icon: "🐰", label: "兔系轮廓", note: "柔软又安静" };
    case "狐狸":
      return { icon: "🦊", label: "狐系轮廓", note: "机灵又漂亮" };
    case "其他":
      return { icon: "🐾", label: "其他外貌", note: "等你补充更多细节" };
    default:
      return {
        icon: "✨",
        label: "外貌占位",
        note: "等你选择品种后会更具体",
      };
  }
};

const getColorDisplay = (color: string) => {
  const normalizedColor = color.trim();

  if (!normalizedColor) {
    return {
      label: "待补充颜色",
      helper: "颜色展示占位",
      swatchClass: "bg-gradient-to-br from-stone-200 via-white to-stone-300",
    };
  }

  const colorMappings = [
    {
      keywords: ["橘白", "白橘"],
      helper: "橘白配色",
      swatchClass: "bg-gradient-to-br from-orange-300 via-white to-orange-100",
    },
    {
      keywords: ["黑白", "白黑", "奶牛"],
      helper: "黑白配色",
      swatchClass: "bg-gradient-to-br from-slate-900 via-white to-slate-300",
    },
    {
      keywords: ["灰白", "白灰"],
      helper: "灰白配色",
      swatchClass: "bg-gradient-to-br from-slate-400 via-white to-slate-200",
    },
    {
      keywords: ["橘", "姜黄"],
      helper: "暖橘色调",
      swatchClass: "bg-orange-300",
    },
    {
      keywords: ["奶油", "米白", "米色"],
      helper: "奶油色调",
      swatchClass: "bg-amber-100",
    },
    {
      keywords: ["白"],
      helper: "浅色毛感",
      swatchClass: "bg-white",
    },
    {
      keywords: ["黑"],
      helper: "深色毛感",
      swatchClass: "bg-slate-900",
    },
    {
      keywords: ["灰", "银"],
      helper: "灰色毛感",
      swatchClass: "bg-slate-400",
    },
    {
      keywords: ["棕", "咖啡"],
      helper: "棕色毛感",
      swatchClass: "bg-amber-700",
    },
    {
      keywords: ["金", "黄"],
      helper: "金黄色调",
      swatchClass: "bg-amber-300",
    },
    {
      keywords: ["蓝"],
      helper: "蓝色调",
      swatchClass: "bg-sky-300",
    },
    {
      keywords: ["粉"],
      helper: "粉色调",
      swatchClass: "bg-pink-300",
    },
    {
      keywords: ["绿"],
      helper: "绿色调",
      swatchClass: "bg-emerald-300",
    },
  ];

  const matchedColor = colorMappings.find(({ keywords }) =>
    keywords.some((keyword) => normalizedColor.includes(keyword))
  );

  if (matchedColor) {
    return {
      label: normalizedColor,
      helper: matchedColor.helper,
      swatchClass: matchedColor.swatchClass,
    };
  }

  return {
    label: normalizedColor,
    helper: "自定义颜色占位",
    swatchClass: "bg-gradient-to-br from-stone-200 via-white to-stone-300",
  };
};

const getSizeDisplay = (size: string) => {
  switch (size) {
    case "小型":
      return {
        label: "小型体型",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "中型":
      return {
        label: "中型体型",
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "大型":
      return {
        label: "大型体型",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    default:
      return {
        label: "体型待定",
        className: "border-gray-200 bg-white/80 text-gray-500",
      };
  }
};

const summarizeText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

const getAppearanceSummary = (pet: PetProfile) => {
  if (!pet.species && !pet.color && !pet.size) {
    return "现在先用一个温和的外貌占位来代表你的宠物。等你补充品种、颜色和体型后，这里会越来越像一张真正的形象卡。";
  }

  const appearanceCore = [
    pet.color ? `${pet.color}的` : "",
    pet.size || "",
    pet.species || "宠物",
  ]
    .filter(Boolean)
    .join("");

  if (pet.specialTraits) {
    return `它看起来像一只${appearanceCore}，最容易让人记住的地方是${summarizeText(
      pet.specialTraits,
      18
    )}。`;
  }

  return `它看起来像一只${appearanceCore}，整体外貌轮廓已经有一点清晰了，继续补充细节会更生动。`;
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
  const petSpeciesVisual = getSpeciesVisual(pet?.species || "");
  const petColorDisplay = getColorDisplay(pet?.color || "");
  const petSizeDisplay = getSizeDisplay(pet?.size || "");
  const petAppearanceSummary = getAppearanceSummary(
    pet || {
      petName: "",
      species: "",
      color: "",
      size: "",
      personality: "",
      specialTraits: "",
    }
  );

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
                    <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm ring-8 ring-white/70">
                      <span aria-hidden="true">{petSpeciesVisual.icon}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs text-gray-500 shadow-sm">
                      <span
                        className={`h-3 w-3 rounded-full ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      {petColorDisplay.helper}
                    </div>
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

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {petSpeciesVisual.label}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${petSizeDisplay.className}`}
                      >
                        {petSizeDisplay.label}
                      </span>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {petColorDisplay.label}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-amber-700">
                      {petSpeciesVisual.note}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">品种外貌</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {petSpeciesVisual.icon} {petCardSpecies}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">主颜色</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`h-10 w-10 rounded-2xl ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {petCardColor}
                        </p>
                        <p className="text-xs text-gray-500">
                          {petColorDisplay.helper}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">体型</p>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petSizeDisplay.className}`}
                      >
                        {petCardSize}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-900">外貌摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petAppearanceSummary}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 p-4 text-sm leading-6 text-gray-600">
                  现在这张资料卡已经能用品种图标、颜色展示和体型标签，先把宠物的外貌感做出来，后续如果接图片也能自然延展。
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
                    编辑我的宠物
                  </Link>

                  <p className="text-sm text-gray-500">
                    想更新资料的话，回到创建页面继续编辑并重新保存一次就可以。
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
