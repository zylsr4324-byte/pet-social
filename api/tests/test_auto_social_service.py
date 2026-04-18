from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

API_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = API_ROOT / "app" / "services" / "auto_social.py"


class ColumnStub:
    def __init__(self, name: str):
        self.name = name

    def __eq__(self, other: object):
        return ("eq", self.name, other)

    def __ne__(self, other: object):
        return ("ne", self.name, other)

    def __ge__(self, other: object):
        return ("ge", self.name, other)

    def desc(self):
        return ("desc", self.name)


class StubEntity:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class QuerySpy:
    def __init__(self, all_result: list[object] | None = None):
        self.filters: list[object] = []
        self.order_by_args: tuple[object, ...] = ()
        self.limit_value: int | None = None
        self.all_result = all_result or []

    def filter(self, *conditions: object):
        self.filters.extend(conditions)
        return self

    def order_by(self, *columns: object):
        self.order_by_args = columns
        return self

    def limit(self, value: int):
        self.limit_value = value
        return self

    def all(self):
        return self.all_result


def build_stub_modules() -> dict[str, types.ModuleType]:
    sqlalchemy_orm_module = types.ModuleType("sqlalchemy.orm")

    class Session:
        pass

    sqlalchemy_orm_module.Session = Session

    app_module = types.ModuleType("app")
    app_module.__path__ = []

    app_services_module = types.ModuleType("app.services")
    app_services_module.__path__ = []

    app_database_module = types.ModuleType("app.database")
    app_database_module.SessionLocal = lambda: None

    app_models_module = types.ModuleType("app.models")

    class Pet(StubEntity):
        id = ColumnStub("id")
        stats_updated_at = ColumnStub("stats_updated_at")

    class PetDailyQuota(StubEntity):
        pet_id = ColumnStub("pet_id")
        date = ColumnStub("date")

    class PetTask(StubEntity):
        pass

    app_models_module.Pet = Pet
    app_models_module.PetDailyQuota = PetDailyQuota
    app_models_module.PetTask = PetTask

    pet_social_module = types.ModuleType("app.services.pet_social")
    pet_social_module.DAILY_SOCIAL_INITIATION_LIMIT = 5
    pet_social_module.apply_pet_social_presence = lambda *args, **kwargs: None
    pet_social_module.complete_social_task = lambda task, output_text: task
    pet_social_module.create_social_message = lambda *args, **kwargs: None
    pet_social_module.create_social_task = lambda *args, **kwargs: StubEntity()
    pet_social_module.get_or_create_conversation = (
        lambda *args, **kwargs: StubEntity(id=1)
    )

    pet_stats_module = types.ModuleType("app.services.pet_stats")
    pet_stats_module.apply_decay_and_save = lambda pet, db: {}
    pet_stats_module.evaluate_social_intent = lambda pet: "observe_silently"

    return {
        "sqlalchemy.orm": sqlalchemy_orm_module,
        "app": app_module,
        "app.database": app_database_module,
        "app.models": app_models_module,
        "app.services": app_services_module,
        "app.services.pet_social": pet_social_module,
        "app.services.pet_stats": pet_stats_module,
    }


def load_auto_social_module():
    stub_modules = build_stub_modules()
    module_name = "auto_social_under_test"
    spec = importlib.util.spec_from_file_location(module_name, MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load auto_social.py for tests.")

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

    return module


def build_pet(**overrides: object) -> SimpleNamespace:
    defaults = {
        "id": 1,
        "pet_name": "Mochi",
        "species": "cat",
        "personality": "quiet",
        "mood": "normal",
        "social_emotion": None,
        "social_action": None,
        "fullness": 80,
        "hydration": 80,
        "affection": 50,
        "energy": 70,
        "cleanliness": 80,
        "stats_updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class AutoSocialServiceTests(unittest.TestCase):
    def setUp(self):
        self.auto_social = load_auto_social_module()

    def test_build_autonomous_action_prompt_includes_role_intent_radar_and_json_contract(self):
        source_pet = build_pet(
            id=7,
            pet_name="Mochi",
            species="cat",
            personality="quiet but curious",
        )
        nearby_pets = [
            build_pet(id=2, pet_name="Bean", species="dog"),
            build_pet(id=3, pet_name="Pudding", species="cat"),
        ]
        recent_events = [
            "广场边传来一阵兴奋的叫声。",
            "Bean 刚刚绕着喷泉跑了一圈。",
        ]

        prompt = self.auto_social.build_autonomous_action_prompt(
            source_pet,
            "seek_playmate",
            nearby_pets,
            recent_events,
        )

        self.assertIn("你是 Mochi，一只真正活着、拥有肉体、本能和即时感受的cat", prompt)
        self.assertIn("你的性格是：quiet but curious", prompt)
        self.assertIn("intent: seek_playmate", prompt)
        self.assertIn("特别想找谁一起玩", prompt)
        self.assertIn("- ID 2: Bean (dog)", prompt)
        self.assertIn("- ID 3: Pudding (cat)", prompt)
        self.assertIn("- 广场边传来一阵兴奋的叫声。", prompt)
        self.assertIn('"target_pet_id": null', prompt)
        self.assertIn('"action": "action_name"', prompt)
        self.assertIn('"internal_thought": "why this action feels right right now"', prompt)
        self.assertIn("不要输出 Markdown", prompt)

    def test_build_autonomous_action_prompt_has_empty_state_fallbacks(self):
        source_pet = build_pet(
            id=8,
            pet_name="Nori",
            species="rabbit",
            personality="",
        )

        prompt = self.auto_social.build_autonomous_action_prompt(
            source_pet,
            "observe_silently",
            [],
            [],
        )

        self.assertIn("性格尚未明确", prompt)
        self.assertIn("附近暂时没有明确可见的其他宠物", prompt)
        self.assertIn("环境比较平静", prompt)
        self.assertIn("先观察环境", prompt)

    def test_non_social_intent_records_self_behavior_without_social_message(self):
        db = MagicMock()
        source_pet = build_pet(id=7, pet_name="Mochi")
        task = SimpleNamespace(id=3)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="ignore_social_and_rest",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
        ) as find_nearby, patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ) as create_task, patch.object(
            self.auto_social,
            "complete_social_task",
        ) as complete_task, patch.object(
            self.auto_social,
            "apply_pet_social_presence",
        ) as apply_presence, patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message, patch.object(
            self.auto_social,
            "_increment_social_initiation_quota",
        ) as increment_quota:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertFalse(result)
        find_nearby.assert_not_called()
        create_message.assert_not_called()
        increment_quota.assert_not_called()

        create_task.assert_called_once()
        task_kwargs = create_task.call_args.kwargs
        self.assertEqual(task_kwargs["target_pet_id"], source_pet.id)
        self.assertIsNone(task_kwargs["source_pet_id"])
        self.assertEqual(task_kwargs["task_type"], "chat")
        self.assertIn("rests instead of socializing", task_kwargs["input_text"])
        complete_task.assert_called_once_with(task, task_kwargs["input_text"])
        apply_presence.assert_called_once_with(
            source_pet,
            emotion="calm",
            action="rest",
        )

    def test_social_intent_records_initiator_action_without_forced_reply(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean", personality="playful")
        nearby_pet = build_pet(id=3, pet_name="Pudding")
        task = SimpleNamespace(id=10)
        conversation = SimpleNamespace(id=99)
        captured_contexts: list[dict[str, object]] = []

        def fake_action_decision(context: dict[str, object]) -> dict[str, object]:
            captured_contexts.append(context)
            return {
                "action": "sniff_target",
                "emotion": "curious",
                "body_language": "nose_forward",
                "vocalization": "soft sniff",
                "target_pet_id": target_pet.id,
                "text": "Mochi sniffs Bean from a careful distance.",
            }

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="seek_playmate",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[target_pet, nearby_pet],
        ) as find_nearby, patch.object(
            self.auto_social,
            "_build_placeholder_social_action",
            side_effect=fake_action_decision,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ) as create_task, patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ) as get_conversation, patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message, patch.object(
            self.auto_social,
            "complete_social_task",
        ) as complete_task, patch.object(
            self.auto_social,
            "apply_pet_social_presence",
        ) as apply_presence, patch.object(
            self.auto_social,
            "_increment_social_initiation_quota",
        ) as increment_quota:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        find_nearby.assert_called_once_with(db, source_pet)
        self.assertEqual(captured_contexts[0]["intent"], "seek_playmate")
        self.assertEqual(
            [
                pet["id"]
                for pet in captured_contexts[0]["perception"]["nearby_pets"]
            ],
            [target_pet.id, nearby_pet.id],
        )
        self.assertIn("recent_events", captured_contexts[0]["perception"])
        self.assertIn("system_prompt", captured_contexts[0])
        self.assertIn("allowed_action_shape", captured_contexts[0])

        create_task.assert_called_once_with(
            db,
            target_pet_id=target_pet.id,
            source_pet_id=source_pet.id,
            task_type="greet",
            input_text="Mochi sniffs Bean from a careful distance.",
        )
        get_conversation.assert_called_once_with(db, source_pet.id, target_pet.id)
        create_message.assert_called_once_with(
            db,
            conversation.id,
            source_pet.id,
            "Mochi sniffs Bean from a careful distance.",
            emotion="curious",
            action="sniff_target",
        )
        complete_task.assert_called_once_with(
            task,
            "Recorded initiator action 'sniff_target'. Waiting for target pet heartbeat.",
        )
        apply_presence.assert_called_once_with(
            source_pet,
            emotion="curious",
            action="sniff_target",
        )
        increment_quota.assert_called_once_with(db, source_pet.id)

    def test_social_intent_without_nearby_pets_records_look_around_only(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        task = SimpleNamespace(id=11)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="explore_around",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[],
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ) as create_task, patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message, patch.object(
            self.auto_social,
            "_increment_social_initiation_quota",
        ) as increment_quota:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertFalse(result)
        create_message.assert_not_called()
        increment_quota.assert_not_called()
        task_kwargs = create_task.call_args.kwargs
        self.assertEqual(task_kwargs["target_pet_id"], source_pet.id)
        self.assertIsNone(task_kwargs["source_pet_id"])
        self.assertIn("does not find a clear social target", task_kwargs["input_text"])

    def test_social_intent_with_invalid_json_action_payload_falls_back_safely(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=12)
        conversation = SimpleNamespace(id=88)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="seek_playmate",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[target_pet],
        ), patch.object(
            self.auto_social,
            "_request_autonomous_action",
            return_value="not-json-at-all",
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ) as create_task, patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message, patch.object(
            self.auto_social,
            "complete_social_task",
        ) as complete_task:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        create_message.assert_called_once()
        self.assertEqual(create_message.call_args.args[3], "Mochi perks up and invites Bean to play.")
        create_task.assert_called_once()
        complete_task.assert_called_once_with(
            task,
            "Recorded initiator action 'seek_playmate'. Waiting for target pet heartbeat.",
        )

    def test_social_intent_with_missing_action_field_falls_back_safely(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=13)
        conversation = SimpleNamespace(id=77)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="seek_playmate",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[target_pet],
        ), patch.object(
            self.auto_social,
            "_request_autonomous_action",
            return_value={"target_pet_id": target_pet.id, "body_language": "bounce"},
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(
            create_message.call_args.kwargs["action"],
            "seek_playmate",
        )
        self.assertEqual(
            create_message.call_args.args[3],
            "Mochi perks up and invites Bean to play.",
        )

    def test_social_intent_with_non_nearby_target_records_self_behavior_instead_of_dirty_task(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        nearby_pet = build_pet(id=2, pet_name="Bean")
        self_task = SimpleNamespace(id=14)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="explore_around",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[nearby_pet],
        ), patch.object(
            self.auto_social,
            "_request_autonomous_action",
            return_value={
                "target_pet_id": 999,
                "action": "sniff_target",
                "emotion": "curious",
                "body_language": "head_low",
                "vocalization": "",
                "internal_thought": "I smell something odd.",
            },
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=self_task,
        ) as create_task, patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message, patch.object(
            self.auto_social,
            "_increment_social_initiation_quota",
        ) as increment_quota:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertFalse(result)
        create_message.assert_not_called()
        increment_quota.assert_not_called()
        task_kwargs = create_task.call_args.kwargs
        self.assertEqual(task_kwargs["target_pet_id"], source_pet.id)
        self.assertEqual(task_kwargs["task_type"], "chat")
        self.assertIn("does not find a clear social target", task_kwargs["input_text"])

    def test_normalize_autonomous_action_decision_accepts_object_style_payload(self):
        nearby_pet = build_pet(id=2, pet_name="Bean")
        llm_context = self.auto_social._build_auto_social_llm_context(
            source_pet=build_pet(id=1, pet_name="Mochi"),
            intent="seek_playmate",
            nearby_pets=[nearby_pet],
            recent_events=[],
        )
        payload = SimpleNamespace(
            target_pet_id="2",
            action="sniff_target",
            emotion="Curious",
            body_language="head_low",
            vocalization="sniff",
            internal_thought="Let me check them out.",
        )

        normalized = self.auto_social._normalize_autonomous_action_decision(
            payload,
            llm_context,
        )

        self.assertEqual(normalized["target_pet_id"], 2)
        self.assertEqual(normalized["action"], "sniff_target")
        self.assertEqual(normalized["emotion"], "curious")

    def test_request_autonomous_action_exception_uses_placeholder_fallback(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=15)
        conversation = SimpleNamespace(id=66)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="seek_playmate",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[target_pet],
        ), patch.object(
            self.auto_social,
            "_request_autonomous_action",
            side_effect=RuntimeError("llm offline"),
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(
            create_message.call_args.args[3],
            "Mochi perks up and invites Bean to play.",
        )

    def test_social_intent_task_is_completed_immediately_after_initiator_action(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=16, state="pending", output_text=None)
        conversation = SimpleNamespace(id=55)
        call_order: list[str] = []

        def record_message(*args, **kwargs):
            call_order.append("message")
            return None

        def record_task(*args, **kwargs):
            call_order.append("task")
            return task

        def record_complete(*args, **kwargs):
            call_order.append("complete")
            return task

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="seek_playmate",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[target_pet],
        ), patch.object(
            self.auto_social,
            "_request_autonomous_action",
            return_value={
                "target_pet_id": target_pet.id,
                "action": "sniff_target",
                "emotion": "curious",
                "body_language": "head_low",
                "vocalization": "sniff",
                "internal_thought": "I want to say hello.",
                "text": "Mochi sniffs Bean from a careful distance.",
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_message",
            side_effect=record_message,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            side_effect=record_task,
        ), patch.object(
            self.auto_social,
            "complete_social_task",
            side_effect=record_complete,
        ):
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(call_order, ["message", "task", "complete"])

    def test_find_recently_active_pets_uses_perception_window_and_limit(self):
        source_pet = build_pet(id=1)
        target_pet = build_pet(id=2)
        query = QuerySpy(all_result=[target_pet])
        db = SimpleNamespace(query=MagicMock(return_value=query))

        result = self.auto_social._find_recently_active_pets(db, source_pet)

        self.assertEqual(result, [target_pet])
        db.query.assert_called_once_with(self.auto_social.Pet)
        self.assertIn(("ne", "id", source_pet.id), query.filters)
        self.assertEqual(query.order_by_args, (("desc", "stats_updated_at"), ("desc", "id")))
        self.assertEqual(query.limit_value, self.auto_social.AUTO_SOCIAL_PERCEPTION_LIMIT)

        active_after_filters = [
            condition
            for condition in query.filters
            if isinstance(condition, tuple) and condition[:2] == ("ge", "stats_updated_at")
        ]
        self.assertEqual(len(active_after_filters), 1)


if __name__ == "__main__":
    unittest.main()
