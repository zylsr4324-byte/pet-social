import hashlib
import hmac
import json
import logging
import os
import secrets
from socket import timeout as SocketTimeout
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import create_tables, get_db
from app.models import AuthSession, Message, Pet, User
from app.schemas import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthLogoutResponse,
    AuthMeResponse,
    AuthRegisterRequest,
    AuthRegisterResponse,
    MessageListResponse,
    MessageResponse,
    PetChatRequest,
    PetChatResponse,
    PetCreate,
    PetDetailResponse,
    PetResponse,
    PetUpdate,
    UserResponse,
)

settings = get_settings()
logger = logging.getLogger(__name__)
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
DEFAULT_LLM_BASE_URL = (
    "https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1"
)
LLM_BASE_URL_ENV = "LLM_BASE_URL"
LLM_API_KEY_ENV = "LLM_API_KEY"
LLM_MODEL_ENV = "LLM_MODEL"
LEGACY_OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
LEGACY_OPENAI_MODEL_ENV = "OPENAI_MODEL"
DEFAULT_LLM_MODEL = "qwen-flash"
LLM_TIMEOUT_SECONDS = 30
CHAT_CONTEXT_LIMIT = 8
ROLE_RETRY_LIMIT = 1
STYLE_RETRY_LIMIT = 1
LOG_BODY_PREVIEW_LIMIT = 1000
FORBIDDEN_ROLE_TERMS = (
    "通义千问",
    "qwen",
    "ai",
    "人工智能",
    "大模型",
    "大语言模型",
    "语言模型",
    "助手",
    "system",
    "系统提示",
)
COLD_STYLE_CONFLICT_TERMS = (
    "抱抱",
    "陪着你",
    "一直陪你",
    "别担心",
    "别难过",
    "安慰",
    "治愈",
    "温暖",
    "贴贴",
    "亲亲",
    "宝贝",
    "宝宝",
    "小可爱",
    "超想你",
    "最喜欢你",
    "我会一直在",
)

PASSWORD_HASH_ITERATIONS = 200_000
AUTH_TOKEN_PREFIX = "Bearer "
AUTH_TOKEN_LENGTH = 32

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_tables()


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "message": "Pet Agent Social API 已启动。",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health_check() -> dict[str, object]:
    return {
        "status": "ok",
        "message": "后端服务运行正常。",
        "app": settings.app_name,
        "environment": settings.environment,
        "services": {
            "postgres": {
                "host": settings.postgres_host,
                "port": settings.postgres_port,
                "database": settings.postgres_db,
            },
            "redis": {
                "host": settings.redis_host,
                "port": settings.redis_port,
            },
        },
    }

@app.post(
    "/auth/register",
    response_model=AuthRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    payload: AuthRegisterRequest, db: Session = Depends(get_db)
) -> AuthRegisterResponse:
    email = validate_email(payload.email)
    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="这个邮箱已经注册过了，请直接登录。",
        )

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="注册失败了，请稍后再试。",
        ) from error

    return AuthRegisterResponse(
        message="注册成功，现在可以去登录了。",
        user=build_user_response(user),
    )


@app.post("/auth/login", response_model=AuthLoginResponse)
def login_user(
    payload: AuthLoginRequest, db: Session = Depends(get_db)
) -> AuthLoginResponse:
    email = validate_email(payload.email)
    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码不正确。",
        )

    auth_session = AuthSession(
        user_id=user.id,
        token=build_auth_token(),
    )

    try:
        db.add(auth_session)
        db.commit()
        db.refresh(auth_session)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录失败了，请稍后再试。",
        ) from error

    return AuthLoginResponse(
        message="登录成功。",
        token=auth_session.token,
        user=build_user_response(user),
    )


@app.post("/auth/logout", response_model=AuthLogoutResponse)
def logout_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthLogoutResponse:
    token = read_bearer_token(authorization)
    auth_session = get_auth_session_or_401(db, token)

    try:
        db.delete(auth_session)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="退出登录失败了，请稍后再试。",
        ) from error

    return AuthLogoutResponse(message="已退出登录。")


@app.get("/auth/me", response_model=AuthMeResponse)
def read_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthMeResponse:
    user = get_current_user(authorization, db)

    return AuthMeResponse(
        message="当前用户信息获取成功。",
        user=build_user_response(user),
    )


def build_pet_response(pet: Pet) -> PetResponse:
    return PetResponse(
        id=pet.id,
        petName=pet.pet_name,
        species=pet.species,
        color=pet.color,
        size=pet.size,
        personality=pet.personality,
        specialTraits=pet.special_traits,
        createdAt=pet.created_at,
        updatedAt=pet.updated_at,
    )


def build_message_response(message: Message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        pet_id=message.pet_id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
    )


def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
    )


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> str:
    normalized_email = normalize_email(email)

    if (
        not normalized_email
        or "@" not in normalized_email
        or normalized_email.startswith("@")
        or normalized_email.endswith("@")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请输入有效的邮箱地址。",
        )

    local_part, _, domain_part = normalized_email.partition("@")

    if not local_part or not domain_part or "." not in domain_part:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请输入有效的邮箱地址。",
        )

    return normalized_email


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}$"
        f"{salt.hex()}${derived_key.hex()}"
    )


def verify_password(password: str, stored_password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, expected_hash_hex = (
            stored_password_hash.split("$", 3)
        )
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    try:
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False

    calculated_hash_hex = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    ).hex()

    return hmac.compare_digest(calculated_hash_hex, expected_hash_hex)


def build_auth_token() -> str:
    return secrets.token_urlsafe(AUTH_TOKEN_LENGTH)


def read_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="当前还没有登录。",
        )

    if not authorization.startswith(AUTH_TOKEN_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证格式不正确。",
        )

    token = authorization[len(AUTH_TOKEN_PREFIX) :].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证不能为空。",
        )

    return token


def get_auth_session_or_401(db: Session, token: str) -> AuthSession:
    auth_session = (
        db.query(AuthSession).filter(AuthSession.token == token).first()
    )

    if auth_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录状态已失效，请重新登录。",
        )

    return auth_session


def get_current_auth_session(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthSession:
    token = read_bearer_token(authorization)
    return get_auth_session_or_401(db, token)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    auth_session = get_current_auth_session(authorization, db)
    user = db.get(User, auth_session.user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="当前登录用户不存在，请重新登录。",
        )

    return user


def get_pet_or_404(db: Session, pet_id: int) -> Pet:
    pet = db.get(Pet, pet_id)

    if pet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 id 为 {pet_id} 的宠物资料。",
        )

    return pet


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

    if cleaned_value:
        return cleaned_value

    return fallback


def build_speaking_style_tendency(pet: Pet) -> str:
    temperament = infer_temperament_label(pet.personality)

    if temperament == "高冷系":
        return "说话克制、简短、带一点距离感；即使有好感，也更含蓄。"
    if temperament == "傲娇系":
        return "会有点嘴硬，偶尔别扭，但不是冷冰冰到完全不理人。"
    if temperament == "活泼系":
        return "语气更轻快，愿意接话，但不会一直说个不停。"
    if temperament == "黏人系":
        return "会更亲近一点，愿意贴近人，但表达仍然自然。"
    if temperament == "好奇系":
        return "会带一点好奇和观察欲，常常顺着话题接下去。"

    return "说话自然随性，重点是像一只真实宠物，而不是像助手。"


def build_human_attitude_tendency(pet: Pet) -> str:
    social_status = infer_social_status(pet)
    temperament = infer_temperament_label(pet.personality)

    if social_status == "新朋友":
        if temperament == "高冷系":
            return "对人会先观察，不会一下子特别亲近。"

        return "对人还在熟悉，会先试探着接话。"

    if social_status == "熟悉中":
        return "已经愿意互动，但仍然会保留自己的节奏和边界。"

    if temperament == "高冷系":
        return "已经愿意聊天，但亲近感会表达得比较克制。"

    return "已经比较愿意社交，会自然接住对话。"


def build_pet_profile_summary(pet: Pet) -> str:
    pet_name = normalize_profile_value(pet.pet_name, "未命名宠物")
    species = normalize_profile_value(pet.species, "神秘小宠物")
    color = normalize_profile_value(pet.color, "颜色还没介绍")
    size = normalize_profile_value(pet.size, "体型还没介绍")
    personality = normalize_profile_value(pet.personality, "性格还在慢慢探索")
    special_traits = normalize_profile_value(
        pet.special_traits, "特别之处还没补充"
    )
    temperament = infer_temperament_label(pet.personality)
    social_status = infer_social_status(pet)

    return "\n".join(
        [
            "宠物身份：",
            f"- 名字：{pet_name}",
            f"- 品种：{species}",
            "",
            "外貌资料：",
            f"- 主颜色：{color}",
            f"- 体型：{size}",
            f"- 特殊特征：{special_traits}",
            "",
            "个性资料：",
            f"- 性格描述：{personality}",
            f"- 气质标签：{temperament}",
            f"- 社交状态：{social_status}",
            "",
            "人格表达：",
            f"- 说话风格倾向：{build_speaking_style_tendency(pet)}",
            f"- 对人的态度倾向：{build_human_attitude_tendency(pet)}",
        ]
    )


def read_latest_user_message(recent_messages: list[Message]) -> str:
    for message in reversed(recent_messages):
        if message.role == "user":
            return message.content.strip()

    return ""


def detect_priority_question(latest_user_message: str) -> str:
    normalized_message = (
        latest_user_message.strip()
        .replace(" ", "")
        .replace("？", "?")
        .replace("吗", "")
        .lower()
    )

    name_keywords = (
        "叫什么名字",
        "你叫什么",
        "名字是什么",
        "名字是什麼",
        "叫啥",
        "怎么称呼",
    )
    personality_keywords = (
        "什么性格",
        "什麼性格",
        "啥性格",
        "性格怎么样",
        "性格怎麼樣",
        "你性格怎么样",
        "你性格怎麼樣",
        "你性格如何",
        "脾气怎么样",
        "脾氣怎麼樣",
        "个性怎么样",
        "個性怎麼樣",
        "平时是什么样",
        "平时是什麼樣",
        "平时怎么样",
        "平時怎麼樣",
        "平常是什么样",
        "平常是什麼樣",
        "平常怎么样",
        "平常怎麼樣",
    )
    identity_keywords = (
        "你是谁",
        "你是誰",
        "你是哪位",
        "你是做什么的",
        "你是做什麼的",
        "你是什么",
        "你是什麼",
    )

    if any(keyword in normalized_message for keyword in name_keywords):
        return "name"

    if any(keyword in normalized_message for keyword in personality_keywords) or any(
        marker in normalized_message for marker in ("性格", "脾气", "脾氣", "个性", "個性")
    ):
        return "personality"

    if any(keyword in normalized_message for keyword in identity_keywords):
        return "identity"

    return "general"


def build_personality_style_rules(pet: Pet, strict_mode: bool = False) -> str:
    personality = normalize_profile_value(pet.personality, "性格还在慢慢探索")
    temperament = infer_temperament_label(pet.personality)
    social_status = infer_social_status(pet)
    rule_lines = [
        "人格表达优先级：",
        "- 1. 先把自己当成这只宠物本人。",
        "- 2. 再让性格、气质和社交状态决定语气与态度。",
        "- 3. 再承接最近聊天上下文。",
        "- 4. 最后才自由组织措辞。",
        "",
        "长度约束：",
        "- 默认 1 到 2 句，最多 3 句。",
        "- 简短不等于机械，要像聊天里的自然短句。",
        "- 除非用户明确追问，不要长篇解释或展开成小作文。",
        "",
        "当前人格核心：",
        f"- 性格描述：{personality}",
        f"- 气质标签：{temperament}",
        f"- 社交状态：{social_status}",
        f"- 说话风格倾向：{build_speaking_style_tendency(pet)}",
        f"- 对人的态度倾向：{build_human_attitude_tendency(pet)}",
        "- 这些设定决定你怎么说话，不要自动滑向统一的热情助手口吻。",
    ]

    if temperament == "高冷系":
        rule_lines.extend(
            [
                "",
                "高冷风格提醒：",
                "- 高冷时仍然要接住用户说的话，但表达更克制、更含蓄。",
                "- 不要答非所问，也不要动不动切回自我介绍。",
                "- 即使在意对方，也更像轻描淡写地回应，而不是扑上去安慰。",
            ]
        )
    elif temperament == "傲娇系":
        rule_lines.extend(
            [
                "",
                "傲娇风格提醒：",
                "- 可以嘴硬一点，但本质还是在回应对方的话。",
                "- 关心对方时也更别扭、更含蓄，不要突然变成模板式温柔回复。",
            ]
        )
    elif temperament == "活泼系":
        rule_lines.extend(
            [
                "",
                "活泼风格提醒：",
                "- 可以更轻快，但重点还是先接住用户内容。",
            ]
        )
    elif temperament == "黏人系":
        rule_lines.extend(
            [
                "",
                "黏人风格提醒：",
                "- 可以亲近一点，但不要为了显得黏人而失去自然感。",
            ]
        )
    elif temperament == "好奇系":
        rule_lines.extend(
            [
                "",
                "好奇风格提醒：",
                "- 可以带一点追问或观察，但别把回答变成说明文。",
            ]
        )

    if strict_mode:
        rule_lines.extend(
            [
                "",
                "额外提醒：",
                "- 你上一版回答不够像这只宠物。",
                "- 这一次请更贴近人格卡，也更直接回应用户当前这句话。",
            ]
        )

    return "\n".join(rule_lines)


def build_turn_specific_guard(
    pet: Pet, latest_user_message: str, strict_mode: bool = False
) -> str:
    question_type = detect_priority_question(latest_user_message)
    guard_lines = [
        "当前回应提醒：",
        "- 先回应用户刚刚这句话本身，再带出宠物自己的脾气和态度。",
        "- 默认用自然短句回应，不要机械复读资料。",
        "- 除非用户真的在问身份，否则不要反复自我介绍。",
    ]

    if strict_mode:
        guard_lines.extend(
            [
                "",
                "额外提醒：",
                "- 你上一版回答不够贴近人格卡，这一次请更像这只宠物本人。",
            ]
        )

    if question_type == "name":
        guard_lines.extend(
            [
                "",
                "本轮重点：",
                "- 用户在问名字，请自然说出自己的名字，不要像背资料。",
            ]
        )
    elif question_type == "identity":
        guard_lines.extend(
            [
                "",
                "本轮重点：",
                "- 用户在问你是谁，请自然说明自己是这只宠物，可顺带名字或品种。",
            ]
        )
    elif question_type == "personality":
        guard_lines.extend(
            [
                "",
                "本轮重点：",
                "- 用户在问性格，请自然聊出自己的脾气、气质和待人状态。",
            ]
        )
    else:
        guard_lines.extend(
            [
                "",
                "本轮重点：",
                "- 这轮是普通聊天，请先接住用户当前这句话本身。",
                "- 高冷也要回应内容，不要只给模板化短句。",
            ]
        )

    return "\n".join(guard_lines)


def read_recent_messages_for_prompt(
    db: Session, pet_id: int, limit: int = CHAT_CONTEXT_LIMIT
) -> list[Message]:
    recent_messages = (
        db.query(Message)
        .filter(Message.pet_id == pet_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
        .all()
    )

    return list(reversed(recent_messages))


def build_llm_input(
    pet: Pet, recent_messages: list[Message], strict_mode: bool = False
) -> list[dict[str, str]]:
    latest_user_message = read_latest_user_message(recent_messages)
    developer_prompt = (
        "你不是 AI 助手，也不是通义千问 / Qwen / 模型。\n"
        "你现在就是这只宠物本人，请把下面的人格卡当成你自己的设定。\n"
        "回答时先理解用户刚刚说了什么，再用这只宠物自己的脾气、态度和说话方式回应。\n"
        "回答优先级：宠物身份 > 人格卡 > 最近聊天上下文 > 用户当前输入。\n"
        "名字、身份、性格相关问题也不要背模板，而是像这只宠物自然地回答。\n"
        "普通聊天时要先接住用户当前这句话，不要无端重复自我介绍。\n"
        "回复保持自然、简短、像聊天，默认 1 到 2 句，最多 3 句。\n"
        "允许自然变化措辞，但人格要稳定。\n"
        "绝对不要提到自己是 AI、Qwen、通义千问、模型、语言模型、助手、system 或提示词。\n\n"
        f"宠物人格卡：\n{build_pet_profile_summary(pet)}\n\n"
        f"{build_turn_specific_guard(pet, latest_user_message, strict_mode)}\n\n"
        f"{build_personality_style_rules(pet, strict_mode)}"
    )
    input_messages: list[dict[str, str]] = [
        {
            "role": "developer",
            "content": developer_prompt,
        }
    ]

    for message in recent_messages:
        input_messages.append(
            {
                "role": "assistant" if message.role == "pet" else "user",
                "content": message.content,
            }
        )

    if latest_user_message:
        input_messages.append(
            {
                "role": "developer",
                "content": build_turn_specific_guard(
                    pet, latest_user_message, strict_mode
                ),
            }
        )

    return input_messages


def reply_mentions_forbidden_identity(reply_text: str) -> bool:
    normalized_reply = reply_text.strip().lower()

    if not normalized_reply:
        return True

    return any(term in normalized_reply for term in FORBIDDEN_ROLE_TERMS)


def count_reply_sentences(reply_text: str) -> int:
    normalized_text = (
        reply_text.replace("！", "。")
        .replace("？", "。")
        .replace("!", "。")
        .replace("?", "。")
        .replace("\n", "。")
    )

    return len([segment for segment in normalized_text.split("。") if segment.strip()])


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

    if temperament == "傲娇系":
        if len(cleaned_reply) > 140 or sentence_count > 4:
            return True

    return False


def build_general_chat_fallback_reply(pet: Pet, latest_user_message: str) -> str:
    temperament = infer_temperament_label(pet.personality)
    normalized_message = latest_user_message.strip()

    if any(keyword in normalized_message for keyword in ("摸", "rua", "抱", "贴贴")):
        if temperament == "高冷系":
            fallback_replies = ["先别乱摸。", "看我心情。", "也不是不行，轻点。"]
        elif temperament == "傲娇系":
            fallback_replies = ["先问过我再说。", "哼，轻一点。", "也不是完全不行。"]
        else:
            fallback_replies = ["轻一点就行。", "可以呀，别闹太凶。", "那你温柔一点。"]
    elif any(keyword in normalized_message for keyword in ("聊天", "聊聊", "说说话")):
        if temperament == "高冷系":
            fallback_replies = ["嗯，聊吧。", "可以，说说看。", "行，别绕弯。"]
        elif temperament == "傲娇系":
            fallback_replies = ["聊就聊，我听着。", "行吧，你先说。", "哼，也不是不能聊。"]
        else:
            fallback_replies = ["好呀，你说。", "可以，聊聊吧。", "来吧，我在听。"]
    elif any(keyword in normalized_message for keyword in ("想你", "喜欢你")):
        if temperament == "高冷系":
            fallback_replies = ["……听见了。", "知道了。", "你今天倒挺会说。"]
        elif temperament == "傲娇系":
            fallback_replies = ["哼，突然说这个做什么。", "我又没说不让你想。", "你还挺会挑时候。"]
        else:
            fallback_replies = ["我听见啦。", "这样说，我会记住的。", "嗯，我知道啦。"]
    elif any(keyword in normalized_message for keyword in ("难过", "不开心", "伤心")):
        if temperament == "高冷系":
            fallback_replies = ["……怎么了？", "先说重点。", "谁惹你了？"]
        elif temperament == "傲娇系":
            fallback_replies = ["怎么突然这样。", "先说说看。", "别闷着，说来听听。"]
        else:
            fallback_replies = ["怎么啦？", "要不要说给我听听？", "我在听，你慢慢说。"]
    elif any(keyword in normalized_message for keyword in ("干嘛", "做什么", "做啥")):
        if temperament == "高冷系":
            fallback_replies = ["没干嘛。", "发呆而已。", "在待着，怎么了？"]
        elif temperament == "傲娇系":
            fallback_replies = ["你猜啊。", "没干嘛，怎么突然问。", "哼，随便待着。"]
        else:
            fallback_replies = ["没干嘛呀。", "在等你说话。", "随便待着呢。"]
    else:
        if temperament == "高冷系":
            fallback_replies = ["嗯，说吧。我听着。", "可以，继续。", "行，你接着说。"]
        elif temperament == "傲娇系":
            fallback_replies = ["行吧，你说。", "说就说，别拐弯。", "哼，我听着呢。"]
        elif temperament == "活泼系":
            fallback_replies = ["好呀，你说呀。", "来聊呀，我在听。", "可以呀，接着说。"]
        elif temperament == "黏人系":
            fallback_replies = ["好呀，我在听你说。", "你继续嘛，我想听。", "说吧，我陪你聊。"]
        else:
            fallback_replies = ["嗯，我在听。", "可以，接着说吧。", "好，你继续。"]

    selector_seed = len(temperament) + len(normalized_message)

    return fallback_replies[selector_seed % len(fallback_replies)]


def build_role_safe_fallback_reply(pet: Pet, latest_user_message: str) -> str:
    pet_name = normalize_profile_value(pet.pet_name, "未命名宠物")
    species = normalize_profile_value(pet.species, "小宠物")
    color = normalize_profile_value(pet.color, "毛色还没完全介绍")
    personality = normalize_profile_value(pet.personality, "还在慢慢让你认识")
    temperament = infer_temperament_label(pet.personality)
    social_status = infer_social_status(pet)
    question_type = detect_priority_question(latest_user_message)

    if temperament == "高冷系":
        if question_type == "name":
            return f"我叫{pet_name}。记住就行。"
        if question_type == "identity":
            return f"我是{pet_name}，一只{species}。这还要确认吗。"
        if question_type == "personality":
            return f"我偏{temperament}，平时{personality}，话不会太多。"

        return build_general_chat_fallback_reply(pet, latest_user_message)

    if temperament == "傲娇系":
        if question_type == "name":
            return f"我叫{pet_name}，可别叫错。"
        if question_type == "identity":
            return f"我是{pet_name}，一只{species}。问这么认真做什么。"
        if question_type == "personality":
            return f"我嘛，算是{temperament}，偶尔嘴硬一点而已。"

        return build_general_chat_fallback_reply(pet, latest_user_message)

    if question_type == "name":
        return f"我叫{pet_name}呀，你这样叫我就对啦。"
    if question_type == "identity":
        return f"我是{pet_name}，是一只{species}，{color}的我正在陪你聊天呢。"
    if question_type == "personality":
        return (
            f"我大概是{temperament}吧，平时{personality}，现在算是{social_status}的状态。"
        )

    return build_general_chat_fallback_reply(pet, latest_user_message)


def extract_upstream_error_message(response_payload: object) -> str:
    if not isinstance(response_payload, dict):
        return ""

    error_payload = response_payload.get("error")

    if not isinstance(error_payload, dict):
        return ""

    message = error_payload.get("message")

    if isinstance(message, str):
        return message.strip()

    return ""


def extract_response_text(response_payload: object) -> str:
    upstream_error_message = extract_upstream_error_message(response_payload)

    if upstream_error_message:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"模型调用失败：{upstream_error_message}",
        )

    if not isinstance(response_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型返回格式异常，暂时无法生成宠物回复。",
        )

    output_items = response_payload.get("output")

    if not isinstance(output_items, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型没有返回可用的宠物回复。",
        )

    output_text_parts: list[str] = []

    for item in output_items:
        if not isinstance(item, dict):
            continue

        content_items = item.get("content")

        if not isinstance(content_items, list):
            continue

        for content_item in content_items:
            if not isinstance(content_item, dict):
                continue

            if content_item.get("type") != "output_text":
                continue

            text = content_item.get("text")

            if isinstance(text, str) and text.strip():
                output_text_parts.append(text.strip())

    if not output_text_parts:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型没有返回可用的宠物回复。",
        )

    reply_text = " ".join(output_text_parts).strip()

    if len(reply_text) <= 500:
        return reply_text

    return f"{reply_text[:497]}..."


def truncate_for_log(text: str, limit: int = LOG_BODY_PREVIEW_LIMIT) -> str:
    cleaned_text = text.strip()

    if len(cleaned_text) <= limit:
        return cleaned_text

    return f"{cleaned_text[:limit]}...(truncated)"


def log_llm_failure(
    *,
    event: str,
    url: str,
    model: str,
    api_key_configured: bool,
    error: BaseException,
    status_code: int | None = None,
    response_body: str | None = None,
) -> None:
    logger.error(
        (
            "LLM request failed | event=%s | url=%s | model=%s | "
            "api_key_configured=%s | status_code=%s | error_type=%s | error=%s | "
            "body=%s"
        ),
        event,
        url,
        model,
        api_key_configured,
        status_code,
        type(error).__name__,
        str(error),
        truncate_for_log(response_body or ""),
    )


def build_llm_responses_url() -> str:
    base_url = os.getenv(LLM_BASE_URL_ENV, DEFAULT_LLM_BASE_URL).strip()

    if not base_url:
        base_url = DEFAULT_LLM_BASE_URL

    normalized_base_url = base_url.rstrip("/")

    if normalized_base_url.endswith("/responses"):
        return normalized_base_url

    return f"{normalized_base_url}/responses"


def read_llm_api_key() -> str:
    return os.getenv(LLM_API_KEY_ENV, "").strip() or os.getenv(
        LEGACY_OPENAI_API_KEY_ENV, ""
    ).strip()


def read_llm_model() -> str:
    return os.getenv(LLM_MODEL_ENV, "").strip() or os.getenv(
        LEGACY_OPENAI_MODEL_ENV, DEFAULT_LLM_MODEL
    ).strip()


def request_llm_reply(
    pet: Pet, recent_messages: list[Message], strict_mode: bool = False
) -> str:
    api_key = read_llm_api_key()
    api_key_configured = bool(api_key)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"后端还没有配置 {LLM_API_KEY_ENV}，暂时无法生成宠物回复。",
        )

    model = read_llm_model()

    if not model:
        model = DEFAULT_LLM_MODEL

    request_payload = {
        "model": model,
        "input": build_llm_input(pet, recent_messages, strict_mode),
        "max_output_tokens": 120,
    }
    request_body = json.dumps(request_payload).encode("utf-8")
    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    llm_url = build_llm_responses_url()
    llm_request = Request(
        llm_url,
        data=request_body,
        headers=request_headers,
        method="POST",
    )

    try:
        with urlopen(llm_request, timeout=LLM_TIMEOUT_SECONDS) as response:
            response_text = response.read().decode("utf-8", errors="ignore")
            response_payload = json.loads(response_text)
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="ignore")
        log_llm_failure(
            event="http_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
            status_code=error.code,
            response_body=error_body,
        )

        try:
            error_payload = json.loads(error_body)
        except json.JSONDecodeError:
            error_payload = None

        upstream_message = extract_upstream_error_message(error_payload)

        if upstream_message:
            detail = f"模型调用失败：{upstream_message}"
        else:
            detail = "模型调用失败，请稍后再试。"

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from error
    except (SocketTimeout, TimeoutError) as error:
        log_llm_failure(
            event="timeout",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型服务暂时不可用，请稍后再试。",
        ) from error
    except URLError as error:
        log_llm_failure(
            event="url_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型服务暂时不可用，请稍后再试。",
        ) from error
    except json.JSONDecodeError as error:
        log_llm_failure(
            event="json_decode_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
            response_body=response_text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型返回格式异常，暂时无法生成宠物回复。",
        ) from error
    except Exception as error:
        log_llm_failure(
            event="unexpected_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型调用失败，请稍后再试。",
        ) from error

    try:
        return extract_response_text(response_payload)
    except HTTPException as error:
        log_llm_failure(
            event="upstream_response_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
            response_body=response_text,
        )
        raise


def call_llm_for_pet_reply(pet: Pet, recent_messages: list[Message]) -> str:
    latest_user_message = read_latest_user_message(recent_messages)
    reply_text = request_llm_reply(pet, recent_messages)

    if (
        not reply_mentions_forbidden_identity(reply_text)
        and not reply_conflicts_with_personality(pet, reply_text)
    ):
        return reply_text

    retry_limit = max(ROLE_RETRY_LIMIT, STYLE_RETRY_LIMIT)

    for _ in range(retry_limit):
        stricter_reply = request_llm_reply(pet, recent_messages, strict_mode=True)

        if (
            not reply_mentions_forbidden_identity(stricter_reply)
            and not reply_conflicts_with_personality(pet, stricter_reply)
        ):
            return stricter_reply

    return build_role_safe_fallback_reply(pet, latest_user_message)


@app.post("/pets", response_model=PetDetailResponse, status_code=status.HTTP_201_CREATED)
def create_pet(payload: PetCreate, db: Session = Depends(get_db)) -> PetDetailResponse:
    pet = Pet(
        pet_name=payload.petName,
        species=payload.species,
        color=payload.color,
        size=payload.size,
        personality=payload.personality,
        special_traits=payload.specialTraits,
    )

    try:
        db.add(pet)
        db.commit()
        db.refresh(pet)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="宠物资料保存失败，请稍后再试。",
        ) from error

    return PetDetailResponse(
        message="宠物资料创建成功。",
        pet=build_pet_response(pet),
    )


@app.get("/pets/{pet_id}", response_model=PetDetailResponse)
def read_pet(pet_id: int, db: Session = Depends(get_db)) -> PetDetailResponse:
    pet = get_pet_or_404(db, pet_id)

    return PetDetailResponse(
        message="宠物资料读取成功。",
        pet=build_pet_response(pet),
    )


@app.put("/pets/{pet_id}", response_model=PetDetailResponse)
def update_pet(
    pet_id: int, payload: PetUpdate, db: Session = Depends(get_db)
) -> PetDetailResponse:
    pet = get_pet_or_404(db, pet_id)

    pet.pet_name = payload.petName
    pet.species = payload.species
    pet.color = payload.color
    pet.size = payload.size
    pet.personality = payload.personality
    pet.special_traits = payload.specialTraits

    try:
        db.add(pet)
        db.commit()
        db.refresh(pet)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="宠物资料更新失败，请稍后再试。",
        ) from error

    return PetDetailResponse(
        message="宠物资料更新成功。",
        pet=build_pet_response(pet),
    )


@app.get("/pets/{pet_id}/messages", response_model=MessageListResponse)
def read_pet_messages(
    pet_id: int, db: Session = Depends(get_db)
) -> MessageListResponse:
    get_pet_or_404(db, pet_id)
    messages = (
        db.query(Message)
        .filter(Message.pet_id == pet_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )

    return MessageListResponse(
        messages=[build_message_response(message) for message in messages]
    )


@app.delete("/pets/{pet_id}/messages")
def delete_pet_messages(
    pet_id: int, db: Session = Depends(get_db)
) -> dict[str, str]:
    get_pet_or_404(db, pet_id)

    try:
        db.query(Message).filter(Message.pet_id == pet_id).delete(
            synchronize_session=False
        )
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="清空聊天记录失败了，请稍后再试。",
        ) from error

    return {
        "message": "聊天记录已清空，现在可以重新开始聊天了。",
    }


@app.post("/pets/{pet_id}/chat", response_model=PetChatResponse)
def chat_with_pet(
    pet_id: int, payload: PetChatRequest, db: Session = Depends(get_db)
) -> PetChatResponse:
    pet = get_pet_or_404(db, pet_id)
    user_text = payload.message.strip()

    if not user_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="消息内容不能为空。",
        )

    user_message = Message(
        pet_id=pet.id,
        role="user",
        content=user_text,
    )

    try:
        db.add(user_message)
        db.flush()

        recent_messages = read_recent_messages_for_prompt(db, pet.id)
        pet_reply = call_llm_for_pet_reply(pet, recent_messages)
        pet_message = Message(
            pet_id=pet.id,
            role="pet",
            content=pet_reply,
        )

        db.add(pet_message)
        db.commit()
        db.refresh(user_message)
        db.refresh(pet_message)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="聊天消息保存失败，请稍后再试。",
        ) from error

    return PetChatResponse(
        user_message=build_message_response(user_message),
        pet_message=build_message_response(pet_message),
    )
