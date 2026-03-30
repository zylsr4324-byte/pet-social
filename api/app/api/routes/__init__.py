from app.api.routes.a2a import router as a2a_router
from app.api.routes.auth import router as auth_router
from app.api.routes.pets import router as pets_router
from app.api.routes.social import router as social_router
from app.api.routes.system import router as system_router

__all__ = [
    "a2a_router",
    "auth_router",
    "pets_router",
    "social_router",
    "system_router",
]
