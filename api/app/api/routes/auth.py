from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuthSession, User
from app.schemas import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthLogoutResponse,
    AuthMeResponse,
    AuthRegisterRequest,
    AuthRegisterResponse,
)
from app.services.auth import (
    build_auth_token,
    build_user_response,
    get_current_auth_session,
    get_current_user,
    hash_password,
    validate_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
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


@router.post("/login", response_model=AuthLoginResponse)
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


@router.post("/logout", response_model=AuthLogoutResponse)
def logout_user(
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
) -> AuthLogoutResponse:
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


@router.get("/me", response_model=AuthMeResponse)
def read_current_user_info(
    current_user: User = Depends(get_current_user),
) -> AuthMeResponse:
    return AuthMeResponse(
        message="当前用户读取成功。",
        user=build_user_response(current_user),
    )
