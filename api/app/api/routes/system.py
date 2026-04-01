from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/")
def read_root() -> dict[str, str]:
    return {
        "message": "Pet Agent Social API is running.",
        "health": "/health",
        "docs": "/docs",
    }


@router.get("/health")
def health_check() -> dict[str, object]:
    postgres_status: dict[str, object] = {
        "mode": "database_url" if settings.database_url_override else "host_port",
    }
    redis_status: dict[str, object] = {
        "mode": "redis_url" if settings.redis_url_override else "host_port",
    }

    if settings.database_url_override:
        postgres_status["configured"] = True
    else:
        postgres_status.update(
            {
                "host": settings.postgres_host,
                "port": settings.postgres_port,
                "database": settings.postgres_db,
            }
        )

    if settings.redis_url_override:
        redis_status["configured"] = True
    else:
        redis_status.update(
            {
                "host": settings.redis_host,
                "port": settings.redis_port,
            }
        )

    return {
        "status": "ok",
        "message": "Backend service is healthy.",
        "app": settings.app_name,
        "environment": settings.environment,
        "corsAllowedOrigins": list(settings.cors_allowed_origins),
        "services": {
            "postgres": postgres_status,
            "redis": redis_status,
        },
    }
