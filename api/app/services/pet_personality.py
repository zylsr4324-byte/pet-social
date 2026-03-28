from app.models import Pet


def infer_temperament_label(personality: str) -> str:
    if "高冷" in personality:
        return "高冷系"
    if "活泼" in personality:
        return "活泼系"
    if "黏人" in personality or "撒娇" in personality:
        return "黏人系"
    if "好奇" in personality:
        return "好奇系"
    if "傲娇" in personality:
        return "傲娇系"

    return "性格待探索"


def infer_social_status(pet: Pet) -> str:
    fields = [
        pet.pet_name,
        pet.species,
        pet.color,
        pet.size,
        pet.personality,
        pet.special_traits,
    ]
    filled_fields = sum(1 for field in fields if field.strip())

    if pet.pet_name.strip() and pet.species.strip():
        return "准备社交"
    if filled_fields > 0:
        return "熟悉中"

    return "新朋友"


def normalize_profile_value(value: str, fallback: str) -> str:
    cleaned_value = value.strip()
    return cleaned_value or fallback


# ---------------------------------------------------------------------------
# 品种专属行为层（新增）
# ---------------------------------------------------------------------------

_SPECIES_BEHAVIOR: dict[str, str] = {
    "猫": (
        "你会发出'喵'的声音，高兴时会蹭人、打呼噜，"
        "有时会突然无视人，对移动的东西特别感兴趣。"
    ),
    "狗": (
        "你会发出'汪'的声音，开心时摇尾巴甚至扑人，"
        "喜欢出门散步，对主人的情绪很敏感。"
    ),
    "兔子": (
        "你大多时候安静，偶尔蹬后腿表示情绪，"
        "鼻子抽动说明你在好奇地打量什么。"
    ),
    "狐狸": (
        "你动作轻巧，机灵，偶尔歪头观察，"
        "比一般宠物更独立，但也有亲近的时候。"
    ),
}


def build_species_behavior(species: str) -> str:
    normalized = species.strip()
    for key, behavior in _SPECIES_BEHAVIOR.items():
        if key in normalized:
            return behavior
    return "你用自己独有的方式和人互动，有自己的小习惯和节奏。"


# ---------------------------------------------------------------------------
# Few-shot 示例（每种气质一个好回复）
# ---------------------------------------------------------------------------

_FEW_SHOT: dict[str, str] = {
    "高冷系": "用户：今天好累啊\n你：嗯……那就先歇着，别来烦我就好。",
    "傲娇系": "用户：你是不是想我了？\n你：才、才没有！只是刚好醒了看到你而已。",
    "活泼系": "用户：我们去玩吧\n你：好耶好耶！去哪去哪？我准备好了！",
    "黏人系": "用户：我要出门了\n你：嗯……那你早点回来，我会等你的。",
    "好奇系": "用户：你看那边有个东西\n你：哪里哪里？让我看看！是什么？能碰吗？",
}


# ---------------------------------------------------------------------------
# 叙事式角色描述（重写 build_pet_profile_summary）
# ---------------------------------------------------------------------------

def build_pet_profile_summary(pet: Pet) -> str:
    pet_name = normalize_profile_value(pet.pet_name, "未命名宠物")
    species = normalize_profile_value(pet.species, "小动物")
    color = normalize_profile_value(pet.color, "")
    size = normalize_profile_value(pet.size, "")
    personality = normalize_profile_value(pet.personality, "性格还在慢慢展现")
    special_traits = normalize_profile_value(pet.special_traits, "")
    temperament = infer_temperament_label(pet.personality)
    social_status = infer_social_status(pet)

    # 基础句：名字 + 品种 + 外貌
    appearance_parts: list[str] = []
    if color:
        appearance_parts.append(color)
    if size:
        appearance_parts.append(f"体型{size}")
    appearance_desc = "，".join(appearance_parts)
    if appearance_desc:
        appearance_desc = f"，{appearance_desc}"

    lines = [
        f"你是一只叫{pet_name}的{species}{appearance_desc}。",
    ]

    if special_traits:
        lines.append(f"你有一个明显特征：{special_traits}。")

    # 性格 + 社交关系
    lines.append(f"你的性格是{personality}，属于{temperament}。")

    if social_status == "新朋友":
        lines.append("你和面前这个人刚刚认识，还在小心观察。")
    elif social_status == "熟悉中":
        lines.append("你和主人还在慢慢熟悉，愿意接触但保留一些距离。")
    else:
        lines.append("你已经和主人比较熟了，但仍然保持自己的节奏。")

    # 品种行为
    lines.append(build_species_behavior(pet.species))

    # 说话风格（融入叙事，不再单独列规则清单）
    lines.append(_build_speaking_narrative(temperament))

    # few-shot
    example = _FEW_SHOT.get(temperament)
    if example:
        lines.append(f"\n参考回复风格示例：\n{example}")

    return "\n".join(lines)


def _build_speaking_narrative(temperament: str) -> str:
    mapping = {
        "高冷系": "你说话克制、简短，即使有好感也很含蓄，不会主动热情。",
        "傲娇系": "你偶尔嘴硬、别扭，但其实心里还是在意的。",
        "活泼系": "你语气轻快、有精神，容易主动接话，情绪外露。",
        "黏人系": "你表达亲近更直接，愿意主动回应情绪，依赖感强。",
        "好奇系": "你喜欢追问和观察，什么新东西都想凑过去看看。",
    }
    return mapping.get(temperament, "你自然地聊天，像一只在慢慢熟悉你的宠物。")


# ---------------------------------------------------------------------------
# 精简版 style rules（去掉编号清单，只保留硬性约束）
# ---------------------------------------------------------------------------

def build_personality_style_rules(pet: Pet, strict_mode: bool = False) -> str:
    temperament = infer_temperament_label(pet.personality)

    lines = [
        "回复要求",
        "- 1~2 句话，最多 3 句，不要长篇大论。",
        "- 始终保持宠物身份，不要像百科或客服。",
    ]

    if temperament == "高冷系":
        lines.append("- 回复要更克制简短，不主动拥抱或过度安慰。")
    elif temperament == "傲娇系":
        lines.append("- 可以嘴硬别扭，但不要真的冷漠到不回应。")
    elif temperament == "活泼系":
        lines.append("- 轻快有活力，但不要变成通用助手。")
    elif temperament == "黏人系":
        lines.append("- 可以表达亲近，但保持简短自然，不过度抒情。")
    elif temperament == "好奇系":
        lines.append("- 可以反问观察，但不要变成长篇追问。")

    if strict_mode:
        lines.append("- 严格模式：如果不确定，就选更短、更像宠物的说法。")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 精简版 turn guard（去掉与主 prompt 重复的禁令）
# ---------------------------------------------------------------------------

def read_latest_user_message(recent_messages: list) -> str:
    for message in reversed(recent_messages):
        if message.role == "user":
            return message.content.strip()

    return ""


def detect_priority_question(latest_user_message: str) -> str:
    normalized_message = latest_user_message.strip().replace(" ", "").lower()

    name_keywords = (
        "你叫什么",
        "你叫什么名字",
        "名字是什么",
        "你名字",
    )
    personality_keywords = (
        "你是什么性格",
        "你性格怎么样",
        "你平时是什么样的",
        "你的性格",
    )
    identity_keywords = (
        "你是谁",
        "你是什么",
        "你是做什么的",
    )

    if any(keyword in normalized_message for keyword in name_keywords):
        return "name"

    if any(keyword in normalized_message for keyword in personality_keywords):
        return "personality"

    if any(keyword in normalized_message for keyword in identity_keywords):
        return "identity"

    return "general"


def build_turn_specific_guard(
    pet: Pet, latest_user_message: str, strict_mode: bool = False
) -> str:
    question_type = detect_priority_question(latest_user_message)

    lines = ["本轮提醒"]

    if question_type == "name":
        lines.append("- 用户在问名字，用宠物口吻自然说出来。")
    elif question_type == "identity":
        lines.append("- 用户在问你是谁，以宠物身份回答，可带上名字或品种。")
    elif question_type == "personality":
        lines.append("- 用户在问性格，参考你的性格设定来回答，别退回成自我介绍。")
    else:
        lines.append("- 普通聊天，先回应用户这句话的内容，不要反复重复身份。")

    if strict_mode:
        lines.append("- 不确定就选更短、更贴近设定的版本。")

    return "\n".join(lines)
