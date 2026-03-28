from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

API_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = API_ROOT / "app" / "services" / "pet_social.py"


class ColumnStub:
    def __init__(self, name: str):
        self.name = name

    def __eq__(self, other: object):
        return ("eq", self.name, other)

    def __ne__(self, other: object):
        return ("ne", self.name, other)

    def desc(self):
        return ("desc", self.name)


class StubEntity:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def build_stub_modules() -> tuple[dict[str, types.ModuleType], type[Exception]]:
    fastapi_module = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    fastapi_module.HTTPException = HTTPException
    fastapi_module.status = SimpleNamespace(
        HTTP_400_BAD_REQUEST=400,
        HTTP_409_CONFLICT=409,
        HTTP_500_INTERNAL_SERVER_ERROR=500,
        HTTP_502_BAD_GATEWAY=502,
    )

    sqlalchemy_module = types.ModuleType("sqlalchemy")
    sqlalchemy_module.or_ = lambda *conditions: ("or", conditions)

    sqlalchemy_orm_module = types.ModuleType("sqlalchemy.orm")

    class Session:
        pass

    sqlalchemy_orm_module.Session = Session

    app_module = types.ModuleType("app")
    app_module.__path__ = []

    app_services_module = types.ModuleType("app.services")
    app_services_module.__path__ = []

    app_models_module = types.ModuleType("app.models")

    class Pet(StubEntity):
        id = ColumnStub("id")
        created_at = ColumnStub("created_at")

    class PetConversation(StubEntity):
        id = ColumnStub("id")
        pet_a_id = ColumnStub("pet_a_id")
        pet_b_id = ColumnStub("pet_b_id")
        created_at = ColumnStub("created_at")

    class PetFriendship(StubEntity):
        pet_a_id = ColumnStub("pet_a_id")
        pet_b_id = ColumnStub("pet_b_id")
        initiated_by = ColumnStub("initiated_by")
        status = ColumnStub("status")
        accepted_at = ColumnStub("accepted_at")
        created_at = ColumnStub("created_at")

    class PetSocialMessage(StubEntity):
        id = ColumnStub("id")
        conversation_id = ColumnStub("conversation_id")
        sender_pet_id = ColumnStub("sender_pet_id")
        created_at = ColumnStub("created_at")

    class PetTask(StubEntity):
        id = ColumnStub("id")
        source_pet_id = ColumnStub("source_pet_id")
        target_pet_id = ColumnStub("target_pet_id")
        created_at = ColumnStub("created_at")

    app_models_module.Pet = Pet
    app_models_module.PetConversation = PetConversation
    app_models_module.PetFriendship = PetFriendship
    app_models_module.PetSocialMessage = PetSocialMessage
    app_models_module.PetTask = PetTask

    app_schemas_module = types.ModuleType("app.schemas")
    for name in (
        "FriendshipResponse",
        "PetResponse",
        "PetTaskResponse",
        "SocialCandidateResponse",
        "SocialMessageResponse",
        "SocialTaskHistoryItemResponse",
    ):
        setattr(app_schemas_module, name, StubEntity)

    llm_client_module = types.ModuleType("app.services.llm_client")
    llm_client_module.request_llm_reply = lambda input_messages: "stub-reply"

    pet_personality_module = types.ModuleType("app.services.pet_personality")
    pet_personality_module.build_personality_style_rules = (
        lambda target_pet, strict_mode=False: "style-rules"
    )
    pet_personality_module.build_pet_profile_summary = (
        lambda pet: f"profile:{getattr(pet, 'pet_name', 'pet')}"
    )
    pet_personality_module.build_turn_specific_guard = (
        lambda target_pet, latest_input, strict_mode=False: "guard-rules"
    )
    pet_personality_module.infer_temperament_label = lambda personality: personality

    pets_module = types.ModuleType("app.services.pets")
    pets_module.build_pet_response = lambda pet: pet
    pets_module.get_pet_or_404 = (
        lambda db, pet_id: SimpleNamespace(id=pet_id, pet_name=f"Pet {pet_id}")
    )

    reply_validation_module = types.ModuleType("app.services.reply_validation")
    reply_validation_module.ROLE_RETRY_LIMIT = 1
    reply_validation_module.STYLE_RETRY_LIMIT = 1
    reply_validation_module.reply_conflicts_with_personality = (
        lambda target_pet, reply_text: False
    )
    reply_validation_module.reply_mentions_forbidden_identity = (
        lambda reply_text: False
    )

    modules = {
        "fastapi": fastapi_module,
        "sqlalchemy": sqlalchemy_module,
        "sqlalchemy.orm": sqlalchemy_orm_module,
        "app": app_module,
        "app.models": app_models_module,
        "app.schemas": app_schemas_module,
        "app.services": app_services_module,
        "app.services.llm_client": llm_client_module,
        "app.services.pet_personality": pet_personality_module,
        "app.services.pets": pets_module,
        "app.services.reply_validation": reply_validation_module,
    }
    return modules, HTTPException


def load_pet_social_module():
    stub_modules, http_exception = build_stub_modules()
    module_name = "pet_social_under_test"
    spec = importlib.util.spec_from_file_location(module_name, MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load pet_social.py for tests.")

    module = importlib.util.module_from_spec(spec)
    previous_modules = {
        name: sys.modules.get(name)
        for name in (*stub_modules.keys(), module_name)
    }

    try:
        sys.modules.update(stub_modules)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
    finally:
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous

    return module, http_exception


class PetSocialRuleTests(unittest.TestCase):
    def setUp(self):
        self.pet_social, self.http_exception = load_pet_social_module()

    def create_pet(self, pet_id: int, pet_name: str) -> object:
        return self.pet_social.Pet(
            id=pet_id,
            pet_name=pet_name,
            personality="高冷系",
            created_at="2026-03-28T00:00:00Z",
        )

    def create_friendship(
        self,
        *,
        status: str,
        initiated_by: int,
        pet_a_id: int = 1,
        pet_b_id: int = 2,
    ) -> object:
        return self.pet_social.PetFriendship(
            pet_a_id=pet_a_id,
            pet_b_id=pet_b_id,
            initiated_by=initiated_by,
            status=status,
            created_at="2026-03-28T00:00:00Z",
            accepted_at="2026-03-28T01:00:00Z" if status == "accepted" else None,
        )

    def create_query(self, result: list[object]) -> MagicMock:
        query = MagicMock()
        query.filter.return_value = query
        query.order_by.return_value = query
        query.all.return_value = result
        return query

    def test_ensure_friendship_can_chat_requires_accepted_friendship(self):
        with self.assertRaises(self.http_exception) as context:
            self.pet_social.ensure_friendship_can_chat(None)

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("直接聊天", context.exception.detail)
        self.assertIn("好友请求", context.exception.detail)

    def test_ensure_friendship_can_chat_accepts_accepted_friendship(self):
        friendship = self.create_friendship(status="accepted", initiated_by=2)
        self.pet_social.ensure_friendship_can_chat(friendship)

    def test_ensure_friendship_request_allowed_blocks_existing_accepted_friendship(self):
        friendship = self.create_friendship(status="accepted", initiated_by=2)

        with self.assertRaises(self.http_exception) as context:
            self.pet_social.ensure_friendship_request_allowed(friendship, current_pet_id=1)

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("已经是好友", context.exception.detail)
        self.assertIn("直接进入聊天", context.exception.detail)

    def test_ensure_friendship_request_allowed_blocks_outgoing_pending_request(self):
        friendship = self.create_friendship(status="pending", initiated_by=1)

        with self.assertRaises(self.http_exception) as context:
            self.pet_social.ensure_friendship_request_allowed(friendship, current_pet_id=1)

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("等待对方处理", context.exception.detail)

    def test_ensure_friendship_request_allowed_blocks_incoming_pending_request(self):
        friendship = self.create_friendship(status="pending", initiated_by=2)

        with self.assertRaises(self.http_exception) as context:
            self.pet_social.ensure_friendship_request_allowed(friendship, current_pet_id=1)

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("先接受或拒绝", context.exception.detail)

    def test_choose_social_round_target_prioritizes_existing_friend(self):
        source_pet = self.create_pet(1, "源宠物")
        friend_pet = self.create_pet(2, "好友宠物")
        accepted_friendship = self.create_friendship(status="accepted", initiated_by=2)
        friendship_query = self.create_query([accepted_friendship])
        pet_query = self.create_query([])
        db = MagicMock()
        db.query.side_effect = (
            lambda model: friendship_query
            if model is self.pet_social.PetFriendship
            else pet_query
        )

        with patch.object(
            self.pet_social, "get_counterpart_pet", return_value=friend_pet
        ) as get_counterpart_pet:
            target_pet, task_type = self.pet_social.choose_social_round_target(
                db, source_pet
            )

        self.assertIs(target_pet, friend_pet)
        self.assertEqual(task_type, "chat")
        get_counterpart_pet.assert_called_once_with(accepted_friendship, source_pet.id, db)

    def test_choose_social_round_target_falls_back_to_rejected_candidate_for_greet(self):
        source_pet = self.create_pet(1, "源宠物")
        pending_pet = self.create_pet(2, "等待中的对象")
        rejected_pet = self.create_pet(3, "可重试对象")
        friendship_query = self.create_query([])
        pet_query = self.create_query([pending_pet, rejected_pet])
        db = MagicMock()
        db.query.side_effect = (
            lambda model: friendship_query
            if model is self.pet_social.PetFriendship
            else pet_query
        )

        with patch.object(
            self.pet_social,
            "get_friendship_between",
            side_effect=[
                self.create_friendship(status="pending", initiated_by=1),
                self.create_friendship(status="rejected", initiated_by=1, pet_b_id=3),
            ],
        ):
            target_pet, task_type = self.pet_social.choose_social_round_target(
                db, source_pet
            )

        self.assertIs(target_pet, rejected_pet)
        self.assertEqual(task_type, "greet")

    def test_choose_social_round_target_raises_when_only_pending_relationships_exist(self):
        source_pet = self.create_pet(1, "源宠物")
        pending_pet = self.create_pet(2, "等待中的对象")
        friendship_query = self.create_query([])
        pet_query = self.create_query([pending_pet])
        db = MagicMock()
        db.query.side_effect = (
            lambda model: friendship_query
            if model is self.pet_social.PetFriendship
            else pet_query
        )

        with patch.object(
            self.pet_social,
            "get_friendship_between",
            return_value=self.create_friendship(status="pending", initiated_by=1),
        ):
            with self.assertRaises(self.http_exception) as context:
                self.pet_social.choose_social_round_target(db, source_pet)

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("待接收请求", context.exception.detail)
        self.assertIn("等待对方回应", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
