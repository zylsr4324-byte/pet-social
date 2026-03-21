from fastapi import FastAPI

from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)


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
