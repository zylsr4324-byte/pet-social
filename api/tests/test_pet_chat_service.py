from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

API_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = API_ROOT / "app" / "services" / "pet_chat.py"


class StubEntity:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def build_stub_modules():
    fastapi_module = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    fastapi_module.HTTPException = HTTPException

    sqlalchemy_orm_module = types.ModuleType("sqlalchemy.orm")

    class Session:
        pass

    sqlalchemy_orm_module.Session = Session

    app_module = types.ModuleType("app")
    app_module.__path__ = []

    app_services_module = types.ModuleType("app.services")
    app_services_module.__path__ = []

    app_models_module = types.ModuleType("app.models")

    class Message(StubEntity):
        pass

    class Pet(StubEntity):
        pass

    app_models_module.Message = Message
    app_models_module.Pet = Pet

    llm_client_module = types.ModuleType("app.services.llm_client")
    llm_client_module.request_llm_reply = lambda input_messages: "stub-reply"

    pet_personality_module = types.ModuleType("app.services.pet_personality")
    pet_personality_module.build_personality_style_rules = (
        lambda pet, strict_mode=False: "style-rules"
    )
    pet_personality_module.build_pet_profile_summary = lambda pet: "profile"
    pet_personality_module.build_turn_specific_guard = (
        lambda pet, latest_user_message, strict_mode=False: "guard"
    )
    pet_personality_module.read_latest_user_message = (
        lambda recent_messages: recent_messages[-1].content if recent_messages else ""
    )

    pet_stats_module = types.ModuleType("app.services.pet_stats")
    pet_stats_module.calculate_mood = (
        lambda fullness, hydration, energy, cleanliness, affection: "normal"
    )
    pet_stats_module.project_current_stats = lambda pet: {
        "fullness": 100,
        "hydration": 100,
        "energy": 100,
        "cleanliness": 100,
        "affection": 50,
    }

    reply_validation_module = types.ModuleType("app.services.reply_validation")
    reply_validation_module.ROLE_RETRY_LIMIT = 1
    reply_validation_module.STYLE_RETRY_LIMIT = 1
    reply_validation_module.build_role_safe_fallback_reply = (
        lambda pet, latest_user_message: "fallback-reply"
    )
    reply_validation_module.reply_conflicts_with_personality = (
        lambda pet, reply_text: False
    )
    reply_validation_module.reply_mentions_forbidden_identity = (
        lambda reply_text: False
    )

    return {
        "fastapi": fastapi_module,
        "sqlalchemy.orm": sqlalchemy_orm_module,
        "app": app_module,
        "app.models": app_models_module,
        "app.services": app_services_module,
        "app.services.llm_client": llm_client_module,
        "app.services.pet_personality": pet_personality_module,
        "app.services.pet_stats": pet_stats_module,
        "app.services.reply_validation": reply_validation_module,
    }, HTTPException


def load_pet_chat_module():
    stub_modules, http_exception = build_stub_modules()
    module_name = "pet_chat_under_test"
    spec = importlib.util.spec_from_file_location(module_name, MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load pet_chat.py for tests.")

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


class PetChatServiceTests(unittest.TestCase):
    def setUp(self):
        self.pet_chat, self.http_exception = load_pet_chat_module()

    def test_create_pet_chat_turn_rejects_blank_message(self):
        db = MagicMock()
        pet = self.pet_chat.Pet(id=1)

        with self.assertRaises(self.http_exception) as context:
            self.pet_chat.create_pet_chat_turn(db, pet, "   ")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Message content cannot be empty.")

    def test_create_pet_chat_turn_builds_and_stages_user_and_pet_messages(self):
        db = MagicMock()
        pet = self.pet_chat.Pet(id=7)

        with patch.object(
            self.pet_chat,
            "read_recent_messages_for_prompt",
            return_value=[self.pet_chat.Message(pet_id=7, role="user", content="hello")],
        ), patch.object(
            self.pet_chat,
            "call_llm_for_pet_reply",
            return_value="hi back",
        ):
            user_message, pet_message = self.pet_chat.create_pet_chat_turn(
                db, pet, " hello "
            )

        self.assertEqual(user_message.role, "user")
        self.assertEqual(user_message.content, "hello")
        self.assertEqual(pet_message.role, "pet")
        self.assertEqual(pet_message.content, "hi back")
        self.assertEqual(db.add.call_count, 2)
        self.assertEqual(db.flush.call_count, 2)


if __name__ == "__main__":
    unittest.main()
