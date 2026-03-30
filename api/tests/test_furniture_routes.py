from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.furniture import router
from app.database import Base, get_db
from app.models import FurnitureTemplate, Pet, User
from app.services.auth import get_current_user


class FurnitureRouteTests(unittest.TestCase):
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
            self.user = User(email="furniture@example.com", password_hash="hashed")
            db.add(self.user)
            db.flush()
            self.user_id = self.user.id

            self.pet = Pet(
                owner_id=self.user_id,
                pet_name="Mochi",
                species="猫",
                color="橘色",
                size="小型",
                personality="亲人",
                special_traits="爱打滚",
            )
            db.add(self.pet)
            db.flush()
            self.pet_id = self.pet.id

            self.bed_template = FurnitureTemplate(
                name="床",
                category="bed",
                width=2,
                height=1,
                sprite_key="pet_bed",
                interaction_action="bed",
                effects="{}",
            )
            self.plant_template = FurnitureTemplate(
                name="植物",
                category="decoration",
                width=1,
                height=1,
                sprite_key="plant",
                interaction_action=None,
                effects="{}",
            )
            self.sofa_template = FurnitureTemplate(
                name="沙发",
                category="decoration",
                width=2,
                height=1,
                sprite_key="sofa",
                interaction_action=None,
                effects="{}",
            )
            db.add_all([self.bed_template, self.plant_template, self.sofa_template])
            db.commit()
            self.bed_template_id = self.bed_template.id
            self.plant_template_id = self.plant_template.id
            self.sofa_template_id = self.sofa_template.id

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

    def test_place_furniture_accepts_room_and_rotation(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        response = self.client.post(
            f"/pets/{self.pet_id}/furniture",
            json={
                "template_id": self.bed_template_id,
                "room": "bedroom",
                "tile_x": 10,
                "tile_y": 10,
                "rotation": 90,
                "flipped": False,
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["room"], "bedroom")
        self.assertEqual(payload["rotation"], 90)
        self.assertEqual(payload["template"]["name"], "床")

    def test_place_furniture_allows_same_tile_in_different_rooms(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        first = self.client.post(
            f"/pets/{self.pet_id}/furniture",
            json={
                "template_id": self.plant_template_id,
                "room": "living",
                "tile_x": 10,
                "tile_y": 10,
            },
        )
        second = self.client.post(
            f"/pets/{self.pet_id}/furniture",
            json={
                "template_id": self.plant_template_id,
                "room": "bedroom",
                "tile_x": 10,
                "tile_y": 10,
            },
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["room"], "bedroom")

    def test_update_furniture_persists_room_and_rotation(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        create_response = self.client.post(
            f"/pets/{self.pet_id}/furniture",
            json={
                "template_id": self.sofa_template_id,
                "room": "living",
                "tile_x": 9,
                "tile_y": 9,
            },
        )
        placed_id = create_response.json()["id"]

        update_response = self.client.patch(
            f"/pets/{self.pet_id}/furniture/{placed_id}",
            json={
                "room": "bedroom",
                "tile_x": 11,
                "tile_y": 11,
                "rotation": 180,
            },
        )

        self.assertEqual(update_response.status_code, 200)
        payload = update_response.json()
        self.assertEqual(payload["room"], "bedroom")
        self.assertEqual(payload["tile_x"], 11)
        self.assertEqual(payload["tile_y"], 11)
        self.assertEqual(payload["rotation"], 180)

    def test_place_furniture_rejects_overlap_in_same_room(self):
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user

        first = self.client.post(
            f"/pets/{self.pet_id}/furniture",
            json={
                "template_id": self.bed_template_id,
                "room": "bedroom",
                "tile_x": 10,
                "tile_y": 10,
            },
        )
        second = self.client.post(
            f"/pets/{self.pet_id}/furniture",
            json={
                "template_id": self.plant_template_id,
                "room": "bedroom",
                "tile_x": 11,
                "tile_y": 10,
            },
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["detail"], "目标位置已有家具")
