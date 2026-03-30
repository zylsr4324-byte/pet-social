from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FurnitureTemplate, User, UserFurnitureInventory
from app.schemas import (
    FurnitureTemplateResponse,
    ShopCatalogResponse,
    ShopItemResponse,
    ShopPurchaseRequest,
    ShopPurchaseResponse,
    UserFurnitureInventoryResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/shop", tags=["shop"])

GIFTED_ACTIONS = {"feed", "drink", "play", "bed"}
DEFAULT_TEMPLATE_PRICE = 120
SHOP_PRICES_BY_SPRITE_KEY = {
    "bowl_food": 0,
    "bowl_water": 0,
    "toy_ball": 0,
    "pet_bed": 0,
    "cat_tree": 180,
    "sofa": 240,
    "rug": 160,
    "plant": 90,
}


def _build_template_response(template: FurnitureTemplate) -> FurnitureTemplateResponse:
    return FurnitureTemplateResponse(
        id=template.id,
        name=template.name,
        category=template.category,
        width=template.width,
        height=template.height,
        sprite_key=template.sprite_key,
        interaction_action=template.interaction_action,
        effects=template.effects,
    )


def _get_template_price(template: FurnitureTemplate) -> int:
    return SHOP_PRICES_BY_SPRITE_KEY.get(template.sprite_key, DEFAULT_TEMPLATE_PRICE)


def _is_gifted_template(template: FurnitureTemplate) -> bool:
    return template.interaction_action in GIFTED_ACTIONS


def _build_inventory_response(
    inventory_item: UserFurnitureInventory,
    template: FurnitureTemplate,
) -> UserFurnitureInventoryResponse:
    return UserFurnitureInventoryResponse(
        id=inventory_item.id,
        user_id=inventory_item.user_id,
        template=_build_template_response(template),
        quantity=inventory_item.quantity,
        purchased_at=inventory_item.purchased_at,
    )


def _build_shop_item_response(
    template: FurnitureTemplate,
    owned_quantity: int,
) -> ShopItemResponse:
    is_gifted = _is_gifted_template(template)
    return ShopItemResponse(
        template=_build_template_response(template),
        price=_get_template_price(template),
        is_gifted=is_gifted,
        owned_quantity=owned_quantity,
        can_purchase=not is_gifted,
    )


@router.get("", response_model=ShopCatalogResponse)
def read_shop_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShopCatalogResponse:
    templates = db.query(FurnitureTemplate).order_by(FurnitureTemplate.id.asc()).all()
    inventory_items = (
        db.query(UserFurnitureInventory)
        .filter(UserFurnitureInventory.user_id == current_user.id)
        .order_by(UserFurnitureInventory.id.asc())
        .all()
    )

    inventory_by_template_id = {
        item.template_id: item.quantity for item in inventory_items
    }
    template_by_id = {template.id: template for template in templates}

    return ShopCatalogResponse(
        coins=current_user.coins,
        items=[
            _build_shop_item_response(
                template,
                inventory_by_template_id.get(template.id, 0),
            )
            for template in templates
        ],
        inventory=[
            _build_inventory_response(item, template_by_id[item.template_id])
            for item in inventory_items
            if item.template_id in template_by_id
        ],
    )


@router.post("/purchase", response_model=ShopPurchaseResponse)
def purchase_furniture(
    payload: ShopPurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShopPurchaseResponse:
    db_user = db.get(User, current_user.id)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户状态已失效，请重新登录",
        )

    template = (
        db.query(FurnitureTemplate)
        .filter(FurnitureTemplate.id == payload.template_id)
        .first()
    )
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="家具模板不存在",
        )

    if _is_gifted_template(template):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="基础家具已默认赠送，无需购买",
        )

    price = _get_template_price(template)
    if db_user.coins < price:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="金币不足，暂时无法购买这件家具",
        )

    inventory_item = (
        db.query(UserFurnitureInventory)
        .filter(
            UserFurnitureInventory.user_id == db_user.id,
            UserFurnitureInventory.template_id == template.id,
        )
        .first()
    )

    try:
        db_user.coins -= price
        if inventory_item is None:
            inventory_item = UserFurnitureInventory(
                user_id=db_user.id,
                template_id=template.id,
                quantity=1,
            )
            db.add(inventory_item)
        else:
            inventory_item.quantity += 1

        db.commit()
        db.refresh(db_user)
        db.refresh(inventory_item)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="购买失败了，请稍后再试。",
        ) from error

    return ShopPurchaseResponse(
        message=f"已购买「{template.name}」",
        coins=db_user.coins,
        item=_build_shop_item_response(template, inventory_item.quantity),
        inventory_item=_build_inventory_response(inventory_item, template),
    )
