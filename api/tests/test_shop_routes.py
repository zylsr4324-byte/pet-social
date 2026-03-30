from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.shop import router
from app.database import Base, get_db
from app.models import FurnitureTemplate, User, UserFurnitureInventory
from app.services.auth import get_current_user


class ShopRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        Base.metadata.create_all(bind=self.engine)

        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_db] = self.override_get_db
        self.client = TestClient(self.app)

        with self.SessionLocal() as db:
            user = User(
                email="shop@example.com",
                password_hash="hashed",
                coins=500,
            )
            db.add(user)
            db.flush()
            self.user_id = user.id

            gifted_template = FurnitureTemplate(
                name="食盆",
                category="food",
                width=1,
                height=1,
                sprite_key="bowl_food",
                interaction_action="feed",
                effects="{}",
            )
            paid_template = FurnitureTemplate(
                name="沙发",
                category="decoration",
                width=2,
                height=1,
                sprite_key="sofa",
                interaction_action=None,
                effects="{}",
            )
            db.add_all([gifted_template, paid_template])
            db.flush()
            self.gifted_template_id = gifted_template.id
            self.paid_template_id = paid_template.id

            db.add(
                UserFurnitureInventory(
                    user_id=self.user_id,
                    template_id=self.gifted_template_id,
                    quantity=1,
                )
            )
            db.commit()

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def override_get_db(self):
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user(self):
        with self.SessionLocal() as db:
            return db.get(User, self.user_id)

    def test_read_shop_catalog_returns_coins_items_and_inventory(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        response = self.client.get("/shop")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["coins"], 500)
        self.assertEqual(len(payload["items"]), 2)
        self.assertEqual(len(payload["inventory"]), 1)
        self.assertEqual(payload["inventory"][0]["template"]["name"], "食盆")

    def test_purchase_furniture_deducts_coins_and_increases_inventory(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        response = self.client.post(
            "/shop/purchase",
            json={"template_id": self.paid_template_id},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["coins"], 260)
        self.assertEqual(payload["inventory_item"]["quantity"], 1)
        self.assertEqual(payload["item"]["owned_quantity"], 1)

    def test_purchase_gifted_template_is_rejected(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        response = self.client.post(
            "/shop/purchase",
            json={"template_id": self.gifted_template_id},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "基础家具已默认赠送，无需购买")
