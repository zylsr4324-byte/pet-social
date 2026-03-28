import type { PetProfile } from "./pet";

export const getSpeciesVisual = (species: string) => {
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

export const getColorDisplay = (color: string) => {
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

export const getSizeDisplay = (size: string) => {
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

export const summarizeText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

export const getAppearanceSummary = (pet: PetProfile) => {
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

export const getTemperamentTag = (personality: string) => {
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

export const getSocialStatus = (pet: PetProfile) => {
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
