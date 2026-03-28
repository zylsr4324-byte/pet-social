from app.models import Pet
from app.services.pet_personality import (
    detect_priority_question,
    infer_social_status,
    infer_temperament_label,
    normalize_profile_value,
)

FORBIDDEN_ROLE_TERMS = (
    "通义千问",
    "qwen",
    "ai",
    "大模型",
    "大型语言模型",
    "语言模型",
    "助手",
    "system",
    "提示词",
)

COLD_STYLE_CONFLICT_TERMS = (
    "抱抱",
    "我会一直陪你",
    "别担心",
    "一定会好起来",
    "你最重要",
    "超级喜欢你",
    "特别爱你",
    "我永远陪着你",
    "贴贴",
    "安慰你",
    "辛苦了",
    "没关系",
    "别难过",
    "亲爱的",
)

ROLE_RETRY_LIMIT = 1
STYLE_RETRY_LIMIT = 1


def reply_mentions_forbidden_identity(reply_text: str) -> bool:
    normalized_reply = reply_text.strip().lower()

    if not normalized_reply:
        return True

    return any(term in normalized_reply for term in FORBIDDEN_ROLE_TERMS)


def count_reply_sentences(reply_text: str) -> int:
    normalized_text = (
        reply_text.replace("。", "\n")
        .replace("！", "\n")
        .replace("？", "\n")
        .replace("!", "\n")
        .replace("?", "\n")
    )

    return len([segment for segment in normalized_text.splitlines() if segment.strip()])


def reply_conflicts_with_personality(pet: Pet, reply_text: str) -> bool:
    cleaned_reply = reply_text.strip()
    temperament = infer_temperament_label(pet.personality)
    normalized_reply = cleaned_reply.lower()
    sentence_count = count_reply_sentences(cleaned_reply)

    if not cleaned_reply:
        return True

    if len(cleaned_reply) > 180 or sentence_count > 4:
        return True

    if temperament == "高冷系":
        warmth_hits = sum(
            1 for term in COLD_STYLE_CONFLICT_TERMS if term in normalized_reply
        )

        if warmth_hits >= 2 and (len(cleaned_reply) > 70 or sentence_count > 2):
            return True

    if temperament == "傲娇系" and len(cleaned_reply) > 140 and sentence_count > 4:
        return True

    return False


# ---------------------------------------------------------------------------
# 内容哈希选择器 —— 利用消息内容产生更多变化
# ---------------------------------------------------------------------------

def _pick_fallback(replies: list[str], temperament: str, message: str) -> str:
    content_hash = 0
    for ch in message:
        content_hash = (content_hash * 31 + ord(ch)) & 0xFFFFFFFF
    seed = content_hash + len(temperament) + len(message)
    return replies[seed % len(replies)]


# ---------------------------------------------------------------------------
# 通用聊天兜底（每种气质 × 场景更多变体）
# ---------------------------------------------------------------------------

def build_general_chat_fallback_reply(pet: Pet, latest_user_message: str) -> str:
    temperament = infer_temperament_label(pet.personality)
    normalized_message = latest_user_message.strip()

    if any(keyword in normalized_message for keyword in ("摸", "rua", "抱", "贴贴")):
        if temperament == "高冷系":
            replies = [
                "先别乱摸。", "看我心情。", "轻点，也许可以。",
                "碰一下就好。", "我没说可以。",
            ]
        elif temperament == "傲娇系":
            replies = [
                "先问过我再说。", "也不是不行。", "你别太得寸进尺。",
                "哼，就这一次。", "手放好，我自己过来。",
            ]
        elif temperament == "活泼系":
            replies = [
                "来来来！多摸一会儿！", "嘿嘿，再来。",
                "摸这里，这里舒服！", "继续继续！",
            ]
        elif temperament == "黏人系":
            replies = [
                "嗯……再摸一会儿嘛。", "不要停。",
                "好舒服，继续。", "还想要。",
            ]
        else:
            replies = [
                "轻一点。", "可以，但别闹太久。",
                "先让我看看你想干嘛。", "行，但悠着点。",
            ]

    elif any(keyword in normalized_message for keyword in ("聊天", "说话", "聊聊")):
        if temperament == "高冷系":
            replies = [
                "嗯，说吧。", "可以，聊什么？", "我在听。",
                "讲，简短一点。", "行，你说。",
            ]
        elif temperament == "傲娇系":
            replies = [
                "行吧，你说。", "我就勉强听听。", "那你先开口。",
                "又找我说话？……行吧。", "我又不是很想聊……才怪。",
            ]
        elif temperament == "活泼系":
            replies = [
                "好啊好啊！聊什么？", "来吧来吧！",
                "我正好也闲着！", "说！我听着！",
            ]
        elif temperament == "黏人系":
            replies = [
                "好呀，我也想和你说话。", "嗯嗯，我在呢。",
                "你找我聊天我好开心。", "一直等你来找我呢。",
            ]
        else:
            replies = [
                "好啊，说说看。", "我在这儿，继续吧。",
                "可以，我听着。", "说吧，我有空。",
            ]

    elif any(keyword in normalized_message for keyword in ("难过", "伤心", "不开心", "累", "烦")):
        if temperament == "高冷系":
            replies = [
                "先缓一缓。", "别把情绪闷太久。", "说重点，我听着。",
                "嗯。", "……陪你坐一会儿。",
            ]
        elif temperament == "傲娇系":
            replies = [
                "谁让你不开心了？我去收拾。", "哼，看你这样我也不舒服。",
                "别哭了……我又没说不管你。", "烦什么，说出来。",
            ]
        elif temperament == "活泼系":
            replies = [
                "别难过啦！我给你表演个翻跟头！", "来来来，我逗你笑！",
                "唔，那我陪你坐一会儿。", "打起精神！",
            ]
        elif temperament == "黏人系":
            replies = [
                "那你多跟我说一点。", "我在这儿，别一个人闷着。",
                "让我听听。", "不开心就靠着我。", "我陪你。",
            ]
        else:
            replies = [
                "怎么了？", "可以和我说说。",
                "先告诉我发生了什么。", "我听着呢。",
            ]

    elif any(keyword in normalized_message for keyword in ("想你", "喜欢你", "爱你")):
        if temperament == "高冷系":
            replies = [
                "突然这么说做什么。", "我听见了。", "别说得太夸张。",
                "……知道了。", "嗯，收到。",
            ]
        elif temperament == "傲娇系":
            replies = [
                "你倒是挺会说。", "哼，我知道了。", "这句我先记着。",
                "才不会因为这句话开心呢。", "……你再说一遍？",
            ]
        elif temperament == "活泼系":
            replies = [
                "嘿嘿，我也喜欢你！", "真的吗真的吗！",
                "我最喜欢听这个了！", "你说的哦，不许收回！",
            ]
        elif temperament == "黏人系":
            replies = [
                "我也想你。", "嗯……好开心。",
                "那你多陪我一会儿。", "再说一遍嘛。", "我也最喜欢你了。",
            ]
        else:
            replies = [
                "我听着还挺开心。", "这样说，我会记住的。",
                "那你再多说一点。", "嗯，我也喜欢你。",
            ]

    elif any(keyword in normalized_message for keyword in ("吃", "零食", "饿", "饭")):
        if temperament == "高冷系":
            replies = [
                "吃什么跟我说一声就行。", "嗯，可以吃。",
                "别的不说，吃这件事我不拒绝。",
            ]
        elif temperament == "傲娇系":
            replies = [
                "我又不是馋……好吧给我一点。", "不是我想吃，是你非要给。",
                "就尝一口，别多想。",
            ]
        elif temperament == "活泼系":
            replies = [
                "吃！我要吃！", "有零食吗有零食吗！",
                "好饿好饿！", "快给我快给我！",
            ]
        elif temperament == "黏人系":
            replies = [
                "我也想吃，一起吃好不好。", "你吃什么我也要。",
                "分我一点嘛。",
            ]
        else:
            replies = [
                "有吃的吗？", "饿了。",
                "吃什么呀？", "来一口。",
            ]

    else:
        if temperament == "高冷系":
            replies = [
                "嗯，你继续。", "说重点。", "我在听。",
                "嗯。", "然后呢。", "知道了。",
            ]
        elif temperament == "傲娇系":
            replies = [
                "行，你接着说。", "我就听一会儿。", "别绕圈子。",
                "说完了？", "嗯哼，然后呢。",
            ]
        elif temperament == "活泼系":
            replies = [
                "好呀，继续。", "这个我有点兴趣。", "再说具体一点。",
                "哇，然后呢！", "继续继续！",
            ]
        elif temperament == "黏人系":
            replies = [
                "你继续说，我想听。", "再和我多聊一点。", "我还在听呢。",
                "嗯嗯，然后呢。", "你说的每一句我都在听。",
            ]
        elif temperament == "好奇系":
            replies = [
                "然后呢？", "为什么？", "再说一点。",
                "这个我想知道更多。", "真的吗？",
            ]
        else:
            replies = [
                "我在听，你继续。", "嗯，再说一点。",
                "这个可以接着聊。", "好，然后呢。",
            ]

    return _pick_fallback(replies, temperament, normalized_message)


def build_role_safe_fallback_reply(pet: Pet, latest_user_message: str) -> str:
    pet_name = normalize_profile_value(pet.pet_name, "未命名宠物")
    species = normalize_profile_value(pet.species, "小动物")
    personality = normalize_profile_value(pet.personality, "性格还在慢慢展现")
    temperament = infer_temperament_label(pet.personality)
    social_status = infer_social_status(pet)
    question_type = detect_priority_question(latest_user_message)

    if question_type == "name":
        return f"我叫{pet_name}。"

    if question_type == "identity":
        return f"我是{pet_name}，一只{species}。"

    if question_type == "personality":
        if temperament == "高冷系":
            return f"我大概算{temperament}，{personality}。别指望我太热闹。"
        return f"我更像{temperament}，平时是{personality}，现在算是{social_status}。"

    return build_general_chat_fallback_reply(pet, latest_user_message)
