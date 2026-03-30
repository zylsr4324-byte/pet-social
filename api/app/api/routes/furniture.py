from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FurnitureTemplate, Pet, PlacedFurniture
from app.schemas import (
    FurnitureTemplateListResponse,
    FurnitureTemplateResponse,
    PlacedFurnitureCreate,
    PlacedFurnitureListResponse,
    PlacedFurnitureResponse,
    PlacedFurnitureUpdate,
)
from app.services.auth import get_current_user
from app.models import User

router = APIRouter(tags=["furniture"])
ROOM_IDS = {"living", "bedroom", "kitchen"}
VALID_ROTATIONS = {0, 90, 180, 270}
GRID_SIZE = 20


def _get_owned_pet(pet_id: int, user: User, db: Session) -> Pet:
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.owner_id == user.id).first()
    if not pet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="宠物不存在")
    return pet


def _build_template_response(t: FurnitureTemplate) -> FurnitureTemplateResponse:
    return FurnitureTemplateResponse(
        id=t.id,
        name=t.name,
        category=t.category,
        width=t.width,
        height=t.height,
        sprite_key=t.sprite_key,
        interaction_action=t.interaction_action,
        effects=t.effects,
    )


def _build_placed_response(p: PlacedFurniture, db: Session) -> PlacedFurnitureResponse:
    template = db.query(FurnitureTemplate).filter(FurnitureTemplate.id == p.template_id).first()
    return PlacedFurnitureResponse(
        id=p.id,
        pet_id=p.pet_id,
        template=_build_template_response(template),
        room=p.room,
        tile_x=p.tile_x,
        tile_y=p.tile_y,
        rotation=p.rotation,
        flipped=p.flipped,
        placed_at=p.placed_at,
    )


def _validate_room_and_rotation(room: str, rotation: int) -> None:
    if room not in ROOM_IDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="room 只支持 living / bedroom / kitchen",
        )
    if rotation not in VALID_ROTATIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rotation 只支持 0 / 90 / 180 / 270",
        )


def _get_rotated_dimensions(template: FurnitureTemplate, rotation: int) -> tuple[int, int]:
    if rotation in {90, 270}:
        return template.height, template.width
    return template.width, template.height


def _validate_bounds(
    template: FurnitureTemplate,
    tile_x: int,
    tile_y: int,
    rotation: int,
) -> None:
    width, height = _get_rotated_dimensions(template, rotation)
    left = tile_x - width / 2
    right = tile_x + width / 2
    top = tile_y - height / 2
    bottom = tile_y + height / 2

    if left < 0 or top < 0 or right > GRID_SIZE or bottom > GRID_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="家具不能放在墙内",
        )


def _has_overlap(
    left_a: float,
    right_a: float,
    top_a: float,
    bottom_a: float,
    left_b: float,
    right_b: float,
    top_b: float,
    bottom_b: float,
) -> bool:
    return left_a < right_b and right_a > left_b and top_a < bottom_b and bottom_a > top_b


def _validate_overlap(
    db: Session,
    pet_id: int,
    room: str,
    template: FurnitureTemplate,
    tile_x: int,
    tile_y: int,
    rotation: int,
    ignore_id: int | None = None,
) -> None:
    width, height = _get_rotated_dimensions(template, rotation)
    left = tile_x - width / 2
    right = tile_x + width / 2
    top = tile_y - height / 2
    bottom = tile_y + height / 2

    items = (
        db.query(PlacedFurniture)
        .filter(
            PlacedFurniture.pet_id == pet_id,
            PlacedFurniture.room == room,
        )
        .all()
    )

    for item in items:
        if ignore_id is not None and item.id == ignore_id:
            continue

        item_template = (
            db.query(FurnitureTemplate)
            .filter(FurnitureTemplate.id == item.template_id)
            .first()
        )
        if item_template is None:
            continue

        item_width, item_height = _get_rotated_dimensions(item_template, item.rotation)
        item_left = item.tile_x - item_width / 2
        item_right = item.tile_x + item_width / 2
        item_top = item.tile_y - item_height / 2
        item_bottom = item.tile_y + item_height / 2

        if _has_overlap(left, right, top, bottom, item_left, item_right, item_top, item_bottom):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="目标位置已有家具",
            )


@router.get("/furniture/templates", response_model=FurnitureTemplateListResponse)
def list_furniture_templates(db: Session = Depends(get_db)) -> FurnitureTemplateListResponse:
    templates = db.query(FurnitureTemplate).all()
    return FurnitureTemplateListResponse(
        templates=[_build_template_response(t) for t in templates]
    )


@router.get("/pets/{pet_id}/furniture", response_model=PlacedFurnitureListResponse)
def list_placed_furniture(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlacedFurnitureListResponse:
    _get_owned_pet(pet_id, current_user, db)
    items = (
        db.query(PlacedFurniture)
        .filter(PlacedFurniture.pet_id == pet_id)
        .order_by(PlacedFurniture.room.asc(), PlacedFurniture.id.asc())
        .all()
    )
    return PlacedFurnitureListResponse(
        items=[_build_placed_response(p, db) for p in items]
    )


@router.post("/pets/{pet_id}/furniture", response_model=PlacedFurnitureResponse, status_code=status.HTTP_201_CREATED)
def place_furniture(
    pet_id: int,
    payload: PlacedFurnitureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlacedFurnitureResponse:
    _get_owned_pet(pet_id, current_user, db)

    template = db.query(FurnitureTemplate).filter(FurnitureTemplate.id == payload.template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="家具模板不存在")

    _validate_room_and_rotation(payload.room, payload.rotation)
    _validate_bounds(template, payload.tile_x, payload.tile_y, payload.rotation)
    _validate_overlap(
        db,
        pet_id,
        payload.room,
        template,
        payload.tile_x,
        payload.tile_y,
        payload.rotation,
    )

    placed = PlacedFurniture(
        pet_id=pet_id,
        template_id=payload.template_id,
        room=payload.room,
        tile_x=payload.tile_x,
        tile_y=payload.tile_y,
        rotation=payload.rotation,
        flipped=payload.flipped,
    )
    try:
        db.add(placed)
        db.commit()
        db.refresh(placed)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="放置失败") from e

    return _build_placed_response(placed, db)


@router.patch("/pets/{pet_id}/furniture/{furniture_id}", response_model=PlacedFurnitureResponse)
def update_placed_furniture(
    pet_id: int,
    furniture_id: int,
    payload: PlacedFurnitureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlacedFurnitureResponse:
    _get_owned_pet(pet_id, current_user, db)

    placed = db.query(PlacedFurniture).filter(
        PlacedFurniture.id == furniture_id,
        PlacedFurniture.pet_id == pet_id,
    ).first()
    if not placed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="家具不存在")

    template = db.query(FurnitureTemplate).filter(FurnitureTemplate.id == placed.template_id).first()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="家具模板不存在")

    new_room = payload.room if payload.room is not None else placed.room
    new_x = payload.tile_x if payload.tile_x is not None else placed.tile_x
    new_y = payload.tile_y if payload.tile_y is not None else placed.tile_y
    new_rotation = payload.rotation if payload.rotation is not None else placed.rotation

    _validate_room_and_rotation(new_room, new_rotation)
    _validate_bounds(template, new_x, new_y, new_rotation)
    _validate_overlap(
        db,
        pet_id,
        new_room,
        template,
        new_x,
        new_y,
        new_rotation,
        ignore_id=furniture_id,
    )

    placed.room = new_room
    placed.tile_x = new_x
    placed.tile_y = new_y
    placed.rotation = new_rotation

    if payload.flipped is not None:
        placed.flipped = payload.flipped

    try:
        db.commit()
        db.refresh(placed)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新失败") from e

    return _build_placed_response(placed, db)


@router.delete("/pets/{pet_id}/furniture/{furniture_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_furniture(
    pet_id: int,
    furniture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _get_owned_pet(pet_id, current_user, db)

    placed = db.query(PlacedFurniture).filter(
        PlacedFurniture.id == furniture_id,
        PlacedFurniture.pet_id == pet_id,
    ).first()
    if not placed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="家具不存在")

    try:
        db.delete(placed)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除失败") from e
