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
    llm_client_module = types.ModuleType("app.services.llm_client")
    llm_client_module.request_llm_reply = lambda messages: "{}"

    app_models_module = types.ModuleType("app.models")

    class Pet(StubEntity):
        id = ColumnStub("id")
        stats_updated_at = ColumnStub("stats_updated_at")

    class PetDailyQuota(StubEntity):
        pet_id = ColumnStub("pet_id")
        date = ColumnStub("date")

    class PetTask(StubEntity):
        pass

    class PetFriendship(StubEntity):
        pass

    class PetConversation(StubEntity):
        pass

    app_models_module.Pet = Pet
    app_models_module.PetDailyQuota = PetDailyQuota
    app_models_module.PetTask = PetTask
    app_models_module.PetFriendship = PetFriendship
    app_models_module.PetConversation = PetConversation

    pet_social_module = types.ModuleType("app.services.pet_social")
    pet_social_module.DAILY_SOCIAL_INITIATION_LIMIT = 5
    pet_social_module.apply_pet_social_presence = lambda *args, **kwargs: None
    pet_social_module.complete_social_task = lambda task, output_text: task
    pet_social_module.create_social_message = lambda *args, **kwargs: None
    pet_social_module.create_social_task = lambda *args, **kwargs: StubEntity()
    pet_social_module.estimate_relationship_score = lambda *args, **kwargs: 15
    pet_social_module.generate_social_reply = (
        lambda *args, **kwargs: {
            "emotion": "calm",
            "action": "rest",
            "text": "",
        }
    )
    pet_social_module.get_conversation_between = lambda *args, **kwargs: None
    pet_social_module.get_friendship_between = lambda *args, **kwargs: None
    pet_social_module.get_or_create_conversation = (
        lambda *args, **kwargs: StubEntity(id=1)
    )
    pet_social_module.read_recent_social_messages = lambda *args, **kwargs: []

    pet_stats_module = types.ModuleType("app.services.pet_stats")
    pet_stats_module.apply_decay_and_save = lambda pet, db: {}
    pet_stats_module.evaluate_social_intent = lambda pet: "observe_silently"

    return {
        "sqlalchemy.orm": sqlalchemy_orm_module,
        "app": app_module,
        "app.database": app_database_module,
        "app.models": app_models_module,
        "app.services": app_services_module,
        "app.services.llm_client": llm_client_module,
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
        self.assertIn('"action_type": "approach"', prompt)
        self.assertIn('"target_pet_id": null', prompt)
        self.assertIn('"reason": "why this action feels right right now"', prompt)
        self.assertIn('"should_continue": true', prompt)
        self.assertIn('"metadata": {', prompt)
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

    def test_social_intent_records_initiator_action_and_completes_when_follow_up_stops(self):
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
        complete_task.assert_called_once()
        completion_text = complete_task.call_args.args[1]
        self.assertIn("Auto social exchange completed:", completion_text)
        self.assertIn(
            "Mochi[action=sniff_target, emotion=curious]: Mochi sniffs Bean from a careful distance.",
            completion_text,
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
        self.assertEqual(create_message.call_args.args[3], "Mochi精神一振，主动邀请Bean一起玩。")
        create_task.assert_called_once()
        complete_task.assert_called_once()
        self.assertIn(
            "Mochi[action=seek_playmate, emotion=excited]: Mochi精神一振，主动邀请Bean一起玩。",
            complete_task.call_args.args[1],
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
            "Mochi精神一振，主动邀请Bean一起玩。",
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
            "Mochi精神一振，主动邀请Bean一起玩。",
        )

    def test_request_autonomous_action_calls_existing_llm_and_parses_json(self):
        llm_context = self.auto_social._build_auto_social_llm_context(
            source_pet=build_pet(id=1, pet_name="Mochi"),
            intent="seek_playmate",
            nearby_pets=[build_pet(id=2, pet_name="Bean")],
            recent_events=["Bean just looked around."],
        )

        with patch.object(
            self.auto_social,
            "request_llm_reply",
            return_value=(
                '{"action_type":"approach","text":"Mochi pads toward Bean.",'
                '"target_pet_id":2,"reason":"Bean seems approachable.",'
                '"should_continue":true,"emotion":"friendly",'
                '"metadata":{"body_language":"slow steps",'
                '"vocalization":"soft chirp",'
                '"internal_thought":"I want to say hello."}}'
            ),
        ) as request_llm_reply:
            action = self.auto_social._request_autonomous_action(llm_context)

        request_llm_reply.assert_called_once()
        input_messages = request_llm_reply.call_args.args[0]
        self.assertEqual(input_messages[0]["role"], "developer")
        self.assertEqual(input_messages[0]["content"], llm_context["system_prompt"])
        self.assertEqual(action["action"], "approach")
        self.assertEqual(action["action_type"], "approach")
        self.assertEqual(action["target_pet_id"], 2)
        self.assertEqual(action["reason"], "Bean seems approachable.")
        self.assertTrue(action["should_continue"])
        self.assertEqual(action["emotion"], "friendly")
        self.assertEqual(action["body_language"], "slow steps")
        self.assertEqual(action["vocalization"], "soft chirp")
        self.assertEqual(action["internal_thought"], "I want to say hello.")

    def test_request_autonomous_action_accepts_legacy_json_shape(self):
        llm_context = self.auto_social._build_auto_social_llm_context(
            source_pet=build_pet(id=1, pet_name="Mochi"),
            intent="seek_playmate",
            nearby_pets=[build_pet(id=2, pet_name="Bean")],
            recent_events=[],
        )

        with patch.object(
            self.auto_social,
            "request_llm_reply",
            return_value=(
                '{"action":"seek_playmate","text":"Hi Bean!",'
                '"target_pet_id":2,"emotion":"friendly",'
                '"body_language":"tail wag","vocalization":"chirp",'
                '"internal_thought":"I want to play"}'
            ),
        ):
            action = self.auto_social._request_autonomous_action(llm_context)

        self.assertEqual(action["action"], "seek_playmate")
        self.assertEqual(action["action_type"], "seek_playmate")
        self.assertEqual(action["target_pet_id"], 2)
        self.assertEqual(action["emotion"], "friendly")
        self.assertEqual(action["body_language"], "tail wag")
        self.assertEqual(action["vocalization"], "chirp")
        self.assertEqual(action["internal_thought"], "I want to play")
        self.assertEqual(action["reason"], "I want to play")

    def test_request_autonomous_action_uses_placeholder_when_llm_raises(self):
        llm_context = self.auto_social._build_auto_social_llm_context(
            source_pet=build_pet(id=1, pet_name="Mochi"),
            intent="seek_playmate",
            nearby_pets=[build_pet(id=2, pet_name="Bean")],
            recent_events=[],
        )

        with patch.object(
            self.auto_social,
            "request_llm_reply",
            side_effect=RuntimeError("offline"),
        ):
            action = self.auto_social._request_autonomous_action(llm_context)

        self.assertEqual(action["action"], "seek_playmate")
        self.assertEqual(action["target_pet_id"], 2)

    def test_request_autonomous_action_uses_placeholder_when_llm_payload_is_invalid(self):
        llm_context = self.auto_social._build_auto_social_llm_context(
            source_pet=build_pet(id=1, pet_name="Mochi"),
            intent="observe_silently",
            nearby_pets=[build_pet(id=2, pet_name="Bean")],
            recent_events=[],
        )

        with patch.object(
            self.auto_social,
            "request_llm_reply",
            return_value='{"text":"just watching"}',
        ):
            action = self.auto_social._request_autonomous_action(llm_context)

        self.assertEqual(action["action"], "observe_silently")
        self.assertEqual(action["target_pet_id"], 2)

    def test_normalize_autonomous_action_decision_maps_new_json_shape_to_existing_fields(self):
        nearby_pet = build_pet(id=2, pet_name="Bean")
        llm_context = self.auto_social._build_auto_social_llm_context(
            source_pet=build_pet(id=1, pet_name="Mochi"),
            intent="seek_playmate",
            nearby_pets=[nearby_pet],
            recent_events=[],
        )

        normalized = self.auto_social._normalize_autonomous_action_decision(
            {
                "action_type": "speak",
                "text": "Hi Bean!",
                "target_pet_id": "2",
                "reason": "I want to start a friendly interaction.",
                "should_continue": "true",
                "emotion": "Friendly",
                "metadata": {
                    "body_language": "tail up",
                    "vocalization": "soft chirp",
                    "internal_thought": "This feels safe.",
                },
            },
            llm_context,
        )

        self.assertEqual(normalized["action"], "speak")
        self.assertEqual(normalized["action_type"], "speak")
        self.assertEqual(normalized["target_pet_id"], 2)
        self.assertEqual(normalized["reason"], "I want to start a friendly interaction.")
        self.assertTrue(normalized["should_continue"])
        self.assertEqual(normalized["emotion"], "friendly")
        self.assertEqual(normalized["body_language"], "tail up")
        self.assertEqual(normalized["vocalization"], "soft chirp")
        self.assertEqual(normalized["internal_thought"], "This feels safe.")

    def test_social_intent_task_is_completed_after_multi_turn_attempts(self):
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
            "read_recent_social_messages",
            return_value=[SimpleNamespace(sender_pet_id=1, content="Mochi sniffs Bean from a careful distance.")],
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            return_value={
                "emotion": "warm",
                "action": "reply",
                "text": "Bean leans closer and says hi back.",
                "should_continue": False,
            },
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
        self.assertEqual(call_order, ["message", "task", "message", "complete"])

    def test_auto_social_can_continue_for_multiple_turns(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=17)
        conversation = SimpleNamespace(id=44)
        created_messages: list[tuple[object, ...]] = []
        recent_messages = [
            SimpleNamespace(sender_pet_id=1, content="Mochi says hello."),
            SimpleNamespace(sender_pet_id=2, content="Bean says hello back."),
        ]

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            return_value=recent_messages,
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            side_effect=[
                {
                    "emotion": "warm",
                    "action": "reply",
                    "text": "Bean says hello back.",
                },
                {
                    "emotion": "curious",
                    "action": "follow_up",
                    "text": "Mochi asks if Bean wants to play.",
                },
            ],
        ), patch.object(
            self.auto_social,
            "create_social_message",
            side_effect=lambda *args, **kwargs: created_messages.append(args),
        ) as create_message, patch.object(
            self.auto_social,
            "complete_social_task",
        ) as complete_task:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(create_message.call_count, 3)
        self.assertEqual(created_messages[0][2], source_pet.id)
        self.assertEqual(created_messages[1][2], target_pet.id)
        self.assertEqual(created_messages[2][2], source_pet.id)
        self.assertIn(
            "Bean[action=reply, emotion=warm]: Bean says hello back.",
            complete_task.call_args.args[1],
        )
        self.assertIn(
            "Mochi[action=follow_up, emotion=curious]: Mochi asks if Bean wants to play.",
            complete_task.call_args.args[1],
        )

    def test_auto_social_stops_at_max_turns(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=18)
        conversation = SimpleNamespace(id=45)

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            return_value=[SimpleNamespace(sender_pet_id=1, content="Mochi says hello.")],
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            side_effect=[
                {"emotion": "warm", "action": "reply", "text": "Bean replies."},
                {"emotion": "curious", "action": "follow_up", "text": "Mochi follows up."},
                {"emotion": "warm", "action": "reply", "text": "Bean would keep talking."},
            ],
        ) as generate_reply, patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(create_message.call_count, self.auto_social.AUTO_SOCIAL_MAX_TURNS)
        self.assertEqual(generate_reply.call_count, self.auto_social.AUTO_SOCIAL_MAX_TURNS - 1)

    def test_auto_social_stops_early_when_should_continue_is_false(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=19)
        conversation = SimpleNamespace(id=46)

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": False,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
        ) as generate_reply, patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(create_message.call_count, 1)
        generate_reply.assert_not_called()

    def test_auto_social_stops_when_mid_round_reply_is_not_continueable(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=20)
        conversation = SimpleNamespace(id=47)

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            return_value=[SimpleNamespace(sender_pet_id=1, content="Mochi says hello.")],
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            return_value={"emotion": "calm", "action": "rest", "text": ""},
        ), patch.object(
            self.auto_social,
            "create_social_message",
        ) as create_message, patch.object(
            self.auto_social,
            "complete_social_task",
        ) as complete_task:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(create_message.call_count, 1)
        self.assertIn(
            "Mochi[action=approach, emotion=friendly]: Mochi says hello.",
            complete_task.call_args.args[1],
        )

    def test_auto_social_reads_updated_recent_messages_for_third_turn(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=21)
        conversation = SimpleNamespace(id=48)
        stored_messages = [
            SimpleNamespace(
                sender_pet_id=source_pet.id,
                content="Mochi says hello.",
            )
        ]
        seen_recent_message_lengths: list[int] = []

        def read_recent_messages(*args, **kwargs):
            return list(stored_messages)

        def create_message_side_effect(
            db_arg,
            conversation_id,
            sender_pet_id,
            content,
            *,
            emotion=None,
            action=None,
        ):
            stored_messages.append(
                SimpleNamespace(
                    sender_pet_id=sender_pet_id,
                    content=content,
                    emotion=emotion,
                    action=action,
                )
            )
            return None

        def generate_reply_side_effect(
            *,
            target_pet,
            source_pet,
            recent_messages,
            latest_input,
            task_type,
            memory_context=None,
        ):
            seen_recent_message_lengths.append(len(recent_messages))
            if len(seen_recent_message_lengths) == 1:
                self.assertEqual(len(recent_messages), 2)
                self.assertEqual(recent_messages[-1].content, "Mochi says hello.")
                return {
                    "emotion": "warm",
                    "action": "reply",
                    "text": "Bean says hello back.",
                }
            self.assertEqual(len(recent_messages), 3)
            self.assertEqual(recent_messages[-1].content, "Bean says hello back.")
            return {
                "emotion": "curious",
                "action": "follow_up",
                "text": "Mochi asks what Bean is doing.",
                "should_continue": False,
            }

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            side_effect=read_recent_messages,
        ), patch.object(
            self.auto_social,
            "create_social_message",
            side_effect=create_message_side_effect,
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            side_effect=generate_reply_side_effect,
        ) as generate_reply:
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(seen_recent_message_lengths, [2, 3])
        self.assertEqual(generate_reply.call_count, 2)

    def test_auto_social_passes_lightweight_memory_context_into_replies(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=22)
        conversation = SimpleNamespace(id=49)
        captured_memory_contexts: list[str | None] = []

        def capture_reply_context(**kwargs):
            captured_memory_contexts.append(kwargs.get("memory_context"))
            return {
                "emotion": "warm",
                "action": "reply",
                "text": "Bean says hello back.",
                "should_continue": False,
            }

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            return_value=[SimpleNamespace(sender_pet_id=1, content="Mochi says hello.")],
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            side_effect=capture_reply_context,
        ):
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(len(captured_memory_contexts), 1)
        memory_context = captured_memory_contexts[0]
        self.assertIsInstance(memory_context, str)
        self.assertIn("本轮由 Mochi 主动发起", memory_context)
        self.assertIn("当前轮到 Bean 接 Mochi 的话", memory_context)
        self.assertIn("最新一句是：Mochi says hello.", memory_context)
        self.assertIn("Mochi 刚刚的状态：action=approach, emotion=friendly", memory_context)

    def test_auto_social_third_turn_gets_richer_memory_context_than_second_turn(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        target_pet = build_pet(id=2, pet_name="Bean")
        task = SimpleNamespace(id=23)
        conversation = SimpleNamespace(id=50)
        stored_messages: list[SimpleNamespace] = []
        seen_memory_contexts: list[str] = []

        def read_recent_messages(*args, **kwargs):
            return list(stored_messages)

        def create_message_side_effect(
            db_arg,
            conversation_id,
            sender_pet_id,
            content,
            *,
            emotion=None,
            action=None,
        ):
            stored_messages.append(
                SimpleNamespace(
                    sender_pet_id=sender_pet_id,
                    content=content,
                    emotion=emotion,
                    action=action,
                )
            )
            return None

        def generate_reply_side_effect(**kwargs):
            memory_context = kwargs.get("memory_context") or ""
            seen_memory_contexts.append(memory_context)
            if len(seen_memory_contexts) == 1:
                return {
                    "emotion": "warm",
                    "action": "reply",
                    "text": "Bean says hello back.",
                }
            return {
                "emotion": "curious",
                "action": "follow_up",
                "text": "Mochi asks what Bean is doing.",
                "should_continue": False,
            }

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
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "internal_thought": "I want to start chatting.",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ), patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            side_effect=read_recent_messages,
        ), patch.object(
            self.auto_social,
            "create_social_message",
            side_effect=create_message_side_effect,
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            side_effect=generate_reply_side_effect,
        ):
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        self.assertEqual(len(seen_memory_contexts), 2)
        self.assertIn("最近几句互动：", seen_memory_contexts[0])
        self.assertIn("Mochi[action=approach, emotion=friendly]: Mochi says hello.", seen_memory_contexts[0])
        self.assertIn("Bean[action=reply, emotion=warm]: Bean says hello back.", seen_memory_contexts[1])
        self.assertGreater(len(seen_memory_contexts[1]), len(seen_memory_contexts[0]))

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

    def test_rank_auto_social_targets_prefers_more_familiar_candidate(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        familiar_pet = build_pet(id=2, pet_name="Bean", energy=75, social_action="wag")
        stranger_pet = build_pet(id=3, pet_name="Pudding", energy=75)
        familiar_conversation = SimpleNamespace(id=12)

        def fake_read_recent_messages(db_arg, conversation_id):
            if conversation_id == familiar_conversation.id:
                return [SimpleNamespace(sender_pet_id=familiar_pet.id, content="hi again")]
            return []

        def fake_friendship(db_arg, source_pet_id, candidate_pet_id):
            if candidate_pet_id == familiar_pet.id:
                return SimpleNamespace(status="accepted")
            return None

        def fake_conversation(db_arg, source_pet_id, candidate_pet_id):
            if candidate_pet_id == familiar_pet.id:
                return familiar_conversation
            return None

        def fake_relationship_score(friendship, recent_messages, current_pet_id):
            if friendship is not None:
                return 85
            return 15

        with patch.object(
            self.auto_social,
            "get_friendship_between",
            side_effect=fake_friendship,
        ), patch.object(
            self.auto_social,
            "get_conversation_between",
            side_effect=fake_conversation,
        ), patch.object(
            self.auto_social,
            "estimate_relationship_score",
            side_effect=fake_relationship_score,
        ), patch.object(
            self.auto_social,
            "read_recent_social_messages",
            side_effect=fake_read_recent_messages,
        ):
            ranked = self.auto_social._rank_auto_social_targets(
                db,
                source_pet=source_pet,
                nearby_pets=[stranger_pet, familiar_pet],
                intent="seek_playmate",
            )

        self.assertEqual([pet.id for pet in ranked], [familiar_pet.id, stranger_pet.id])

    def test_do_auto_social_round_falls_back_to_ranked_target_when_llm_target_is_unavailable(self):
        db = MagicMock()
        source_pet = build_pet(id=1, pet_name="Mochi")
        higher_rank_pet = build_pet(id=2, pet_name="Bean")
        lower_rank_pet = build_pet(id=3, pet_name="Pudding")
        task = SimpleNamespace(id=24)
        conversation = SimpleNamespace(id=51)

        with patch.object(
            self.auto_social,
            "evaluate_social_intent",
            return_value="seek_playmate",
        ), patch.object(
            self.auto_social,
            "_find_recently_active_pets",
            return_value=[lower_rank_pet, higher_rank_pet],
        ), patch.object(
            self.auto_social,
            "_rank_auto_social_targets",
            return_value=[higher_rank_pet, lower_rank_pet],
        ), patch.object(
            self.auto_social,
            "_request_autonomous_action",
            return_value={
                "target_pet_id": 999,
                "action": "approach",
                "emotion": "friendly",
                "body_language": "step closer",
                "vocalization": "chirp",
                "text": "Mochi says hello.",
                "should_continue": True,
            },
        ), patch.object(
            self.auto_social,
            "get_or_create_conversation",
            return_value=conversation,
        ) as get_conversation, patch.object(
            self.auto_social,
            "create_social_task",
            return_value=task,
        ), patch.object(
            self.auto_social,
            "generate_social_reply",
            return_value={"emotion": "calm", "action": "rest", "text": ""},
        ):
            result = self.auto_social._do_auto_social_round(db, source_pet)

        self.assertTrue(result)
        get_conversation.assert_called_once_with(db, source_pet.id, higher_rank_pet.id)


if __name__ == "__main__":
    unittest.main()
