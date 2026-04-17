import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AuthSession, FurnitureTemplate, User, UserFurnitureInventory
from app.schemas import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthLogoutResponse,
    AuthMeResponse,
    AuthRegisterRequest,
    AuthRegisterResponse,
    AuthSecondMeCallbackRequest,
)
from app.services.auth import (
    build_auth_token,
    build_secondme_placeholder_email,
    build_secondme_token_expires_at,
    build_user_response,
    extract_secondme_email,
    extract_secondme_user_id,
    fetch_secondme_user_profile,
    get_current_auth_session,
    get_current_user,
    hash_password,
    validate_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
DEFAULT_GIFT_ACTIONS = {"feed", "drink", "play", "bed"}


def grant_default_inventory(db: Session, user_id: int) -> None:
    default_templates = (
        db.query(FurnitureTemplate)
        .filter(FurnitureTemplate.interaction_action.in_(DEFAULT_GIFT_ACTIONS))
        .all()
    )
    db.add_all(
        [
            UserFurnitureInventory(
                user_id=user_id,
                template_id=template.id,
                quantity=1,
            )
            for template in default_templates
        ]
    )


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
            detail="This email is already registered. Please sign in instead.",
        )

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
    )

    try:
        db.add(user)
        db.flush()
        grant_default_inventory(db, user.id)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later.",
        ) from error

    return AuthRegisterResponse(
        message="Registration successful. You can sign in now.",
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
            detail="Email or password is incorrect.",
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
            detail="Login failed. Please try again later.",
        ) from error

    return AuthLoginResponse(
        message="Login successful.",
        token=auth_session.token,
        user=build_user_response(user),
    )


@router.post("/secondme/callback", response_model=AuthLoginResponse)
def login_user_with_secondme(
    payload: AuthSecondMeCallbackRequest, db: Session = Depends(get_db)
) -> AuthLoginResponse:
    settings = get_settings()
    secondme_profile = fetch_secondme_user_profile(
        settings.secondme_api_base_url, payload.accessToken
    )
    secondme_user_id = extract_secondme_user_id(secondme_profile)
    secondme_email = extract_secondme_email(secondme_profile)
    token_expires_at = build_secondme_token_expires_at(payload.expiresIn)

    user = db.query(User).filter(User.secondme_user_id == secondme_user_id).first()

    if user is None and secondme_email is not None:
        user = db.query(User).filter(User.email == secondme_email).first()

        if (
            user is not None
            and user.secondme_user_id is not None
            and user.secondme_user_id != secondme_user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already linked to another SecondMe account.",
            )

    created_new_user = False

    if user is None:
        user = User(
            email=secondme_email or build_secondme_placeholder_email(secondme_user_id),
            secondme_user_id=secondme_user_id,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            secondme_access_token=payload.accessToken,
            secondme_refresh_token=payload.refreshToken,
            secondme_token_expires_at=token_expires_at,
        )
        created_new_user = True
        db.add(user)
    else:
        if (
            secondme_email is not None
            and user.email.endswith("@secondme.local")
            and user.email != secondme_email
        ):
            email_owner = db.query(User).filter(User.email == secondme_email).first()

            if email_owner is None or email_owner.id == user.id:
                user.email = secondme_email

        user.secondme_user_id = secondme_user_id
        user.secondme_access_token = payload.accessToken
        user.secondme_refresh_token = payload.refreshToken
        user.secondme_token_expires_at = token_expires_at

    try:
        db.flush()

        if created_new_user:
            grant_default_inventory(db, user.id)

        auth_session = AuthSession(
            user_id=user.id,
            token=build_auth_token(),
        )
        db.add(auth_session)
        db.commit()
        db.refresh(auth_session)
        db.refresh(user)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SecondMe login could not be completed.",
        ) from error

    return AuthLoginResponse(
        message="SecondMe login successful.",
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
            detail="Logout failed. Please try again later.",
        ) from error

    return AuthLogoutResponse(message="Logged out.")


@router.get("/me", response_model=AuthMeResponse)
def read_current_user_info(
    current_user: User = Depends(get_current_user),
) -> AuthMeResponse:
    return AuthMeResponse(
        message="Current user loaded successfully.",
        user=build_user_response(current_user),
    )
