from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/")
def read_root() -> dict[str, str]:
    return {
        "message": "Pet Agent Social API 服务已启动。",
        "health": "/health",
        "docs": "/docs",
    }


@router.get("/health")
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
