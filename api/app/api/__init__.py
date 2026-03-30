from app.api.routes import (
    a2a_router,
    auth_router,
    pets_router,
    social_router,
    system_router,
)

all_routers = (system_router, a2a_router, auth_router, pets_router, social_router)

__all__ = [
    "a2a_router",
    "all_routers",
    "auth_router",
    "pets_router",
    "social_router",
    "system_router",
]
