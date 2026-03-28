from app.api.routes import auth_router, pets_router, system_router

all_routers = (system_router, auth_router, pets_router)

__all__ = ["all_routers", "auth_router", "pets_router", "system_router"]
