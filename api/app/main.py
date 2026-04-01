from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api import all_routers
from app.config import get_settings
from app.database import get_db
from app.models import Pet, User
from app.schemas import PetListResponse
from app.services.auth import get_current_user
from app.services.pets import build_pet_response
from app.startup import run_shutdown, run_startup

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/pets", response_model=PetListResponse)
def list_current_user_pets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PetListResponse:
    pets = (
        db.query(Pet)
        .filter(Pet.owner_id == current_user.id)
        .order_by(Pet.created_at.desc(), Pet.id.desc())
        .all()
    )

    return PetListResponse(
        message="Current user's pets loaded successfully.",
        pets=[build_pet_response(pet) for pet in pets],
    )


@app.on_event("startup")
def on_startup() -> None:
    run_startup()


@app.on_event("shutdown")
def on_shutdown() -> None:
    run_shutdown()


for router in all_routers:
    app.include_router(router)
