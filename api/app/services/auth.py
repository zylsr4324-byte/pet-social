import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuthSession, User
from app.schemas import UserResponse

PASSWORD_HASH_ITERATIONS = 200_000
AUTH_TOKEN_PREFIX = "Bearer "
AUTH_TOKEN_LENGTH = 32


def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        coins=user.coins,
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
            detail="请先登录后再访问这个接口。",
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
    auth_session = db.query(AuthSession).filter(AuthSession.token == token).first()

    if auth_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="当前登录状态已失效，请重新登录。",
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
