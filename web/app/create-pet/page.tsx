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

const getTemperamentTag = (personality: string) => {
  if (personality.includes("高冷")) {
    return {
      label: "高冷系",
      note: "慢热但自带距离感",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (personality.includes("活泼")) {
    return {
      label: "活泼系",
      note: "出场就很有存在感",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (personality.includes("黏人") || personality.includes("撒娇")) {
    return {
      label: "黏人系",
      note: "很容易靠近，也很会表达喜欢",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (personality.includes("好奇")) {
    return {
      label: "好奇系",
      note: "对新朋友和新环境都很感兴趣",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (personality.includes("傲娇")) {
    return {
      label: "傲娇系",
      note: "嘴上不说，态度却很有戏",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  return {
    label: "性格待探索",
    note: "等你补充更多性格线索",
    className: "border-gray-200 bg-white text-gray-500",
  };
};

const getSocialStatus = (pet: PetProfile) => {
  const hasAnyInfo = Boolean(
    pet.petName ||
      pet.species ||
      pet.color ||
      pet.size ||
      pet.personality ||
      pet.specialTraits
  );

  if (!hasAnyInfo) {
    return {
      label: "新朋友",
      note: "刚刚来到这里，准备慢慢认识大家",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (pet.petName && pet.species) {
    return {
      label: "准备社交",
      note: "基本身份已经清晰，可以开始结识其他宠物了",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "熟悉中",
    note: "资料正在慢慢补全，先从认识它开始",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
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
  const petSpeciesVisual = getSpeciesVisual(pet.species);
  const petColorDisplay = getColorDisplay(pet.color);
  const petSizeDisplay = getSizeDisplay(pet.size);
  const petAppearanceSummary = getAppearanceSummary(pet);
  const petTemperamentTag = getTemperamentTag(pet.personality);
  const petSocialStatus = getSocialStatus(pet);

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
                      当前资料会根据左侧输入实时更新，方便你快速确认宠物设定是否完整。
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">气质标签</p>
                    <div className="mt-3 flex items-start gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petTemperamentTag.className}`}
                      >
                        {petTemperamentTag.label}
                      </span>
                      <p className="min-w-0 text-sm leading-6 text-gray-600">
                        {petTemperamentTag.note}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">社交状态</p>
                    <div className="mt-3 flex items-start gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petSocialStatus.className}`}
                      >
                        {petSocialStatus.label}
                      </span>
                      <p className="min-w-0 text-sm leading-6 text-gray-600">
                        {petSocialStatus.note}
                      </p>
                    </div>
                  </div>
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
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
