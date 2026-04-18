from __future__ import annotations

import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

API_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = API_ROOT / "app" / "services" / "a2a.py"


class StubEntity:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class FakeHttpResponse:
    def __init__(self, body: dict[str, object]):
        self._body = json.dumps(body).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def build_stub_modules() -> tuple[dict[str, types.ModuleType], type[Exception]]:
    fastapi_module = types.ModuleType("fastapi")
    fastapi_module.Request = object

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
    app_schemas_module = types.ModuleType("app.schemas")

    class Message(StubEntity):
        pass

    class Pet(StubEntity):
        pass

    class PetTask(StubEntity):
        pass

    class AgentActionPayload:
        def __init__(
            self,
            *,
            action: str,
            emotion: str,
            body_language: str,
            vocalization: str,
        ):
            self.action = action
            self.emotion = emotion
            self.body_language = body_language
            self.vocalization = vocalization

        def model_dump_json(self) -> str:
            return json.dumps(
                {
                    "action": self.action,
                    "emotion": self.emotion,
                    "body_language": self.body_language,
                    "vocalization": self.vocalization,
                }
            )

    app_models_module.Message = Message
    app_models_module.Pet = Pet
    app_models_module.PetTask = PetTask
    app_schemas_module.AgentActionPayload = AgentActionPayload

    pet_chat_module = types.ModuleType("app.services.pet_chat")
    pet_chat_module.create_pet_chat_turn = lambda db, pet, message_text: (
        types.SimpleNamespace(content=message_text.strip()),
        types.SimpleNamespace(content="stub-reply"),
    )

    pet_personality_module = types.ModuleType("app.services.pet_personality")
    pet_personality_module.infer_temperament_label = lambda personality: personality

    return (
        {
            "fastapi": fastapi_module,
            "sqlalchemy.orm": sqlalchemy_orm_module,
            "app": app_module,
            "app.models": app_models_module,
            "app.schemas": app_schemas_module,
            "app.services": app_services_module,
            "app.services.pet_chat": pet_chat_module,
            "app.services.pet_personality": pet_personality_module,
        },
        HTTPException,
    )


def load_a2a_module():
    stub_modules, http_exception = build_stub_modules()
    module_name = "a2a_service_under_test"
    spec = importlib.util.spec_from_file_location(module_name, MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load a2a.py for tests.")

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


class A2AServiceTests(unittest.TestCase):
    def setUp(self):
        self.a2a, self.http_exception = load_a2a_module()

    def test_extract_message_text_accepts_direct_text_and_parts(self):
        self.assertEqual(
            self.a2a.extract_message_text({"text": "hello"}),
            "hello",
        )
        self.assertEqual(
            self.a2a.extract_message_text(
                {
                    "message": {
                        "parts": [
                            {"type": "text", "text": "from-parts"},
                        ]
                    }
                }
            ),
            "from-parts",
        )
        self.assertIsNone(self.a2a.extract_message_text({"message": {"parts": []}}))

    def test_extract_task_id_checks_multiple_shapes(self):
        self.assertEqual(self.a2a.extract_task_id({"taskId": "task-1"}), "task-1")
        self.assertEqual(
            self.a2a.extract_task_id({"task": {"id": "task-2"}}), "task-2"
        )
        self.assertIsNone(self.a2a.extract_task_id({}))

    def test_build_platform_agent_card_uses_request_base_url(self):
        card = self.a2a.build_platform_agent_card(
            types.SimpleNamespace(base_url="https://example.com/")
        )

        self.assertEqual(card["name"], "Pet Agent Social")
        self.assertEqual(card["url"], "https://example.com/.well-known/agent.json")
        self.assertEqual(card["capabilities"]["streaming"], False)

    def test_build_pet_agent_card_points_to_pet_endpoint(self):
        pet = types.SimpleNamespace(
            id=7,
            pet_name="Mochi",
            species="cat",
            personality="curious",
        )
        card = self.a2a.build_pet_agent_card(
            types.SimpleNamespace(base_url="https://example.com/"),
            pet,
        )

        self.assertEqual(card["name"], "Mochi")
        self.assertEqual(card["url"], "https://example.com/a2a/pets/7")
        self.assertEqual(card["metadata"]["petId"], 7)

    def test_serialize_a2a_task_maps_completed_and_failed_states(self):
        completed = types.SimpleNamespace(
            id=1,
            a2a_task_id="task-1",
            state="completed",
            task_type="chat",
            target_pet_id=9,
            source_agent_url="https://agent.example",
            output_text="hello",
        )
        failed = types.SimpleNamespace(
            id=2,
            a2a_task_id="task-2",
            state="failed",
            task_type="chat",
            target_pet_id=9,
            source_agent_url=None,
            output_text="",
        )

        completed_payload = self.a2a.serialize_a2a_task(completed)
        failed_payload = self.a2a.serialize_a2a_task(failed)

        self.assertEqual(completed_payload["state"], "completed")
        self.assertEqual(completed_payload["artifacts"][0]["parts"][0]["text"], "hello")
        self.assertEqual(failed_payload["state"], "failed")

    def test_serialize_a2a_task_maps_canceled_state(self):
        canceled = types.SimpleNamespace(
            id=3,
            a2a_task_id="task-3",
            state="canceled",
            task_type="chat",
            target_pet_id=9,
            source_agent_url=None,
            output_text="",
        )

        canceled_payload = self.a2a.serialize_a2a_task(canceled)

        self.assertEqual(canceled_payload["state"], "canceled")
        self.assertEqual(canceled_payload["status"]["state"], "canceled")

    def test_create_completed_a2a_task_reuses_unified_chat_turn(self):
        db = types.SimpleNamespace(
            add=MagicMock(),
            commit=MagicMock(),
            refresh=MagicMock(),
            rollback=MagicMock(),
        )
        pet = types.SimpleNamespace(id=7)

        with patch.object(
            self.a2a,
            "create_pet_chat_turn",
            return_value=(
                types.SimpleNamespace(content="hello"),
                types.SimpleNamespace(content="hi back"),
            ),
        ):
            task = self.a2a.create_completed_a2a_task(db, pet, "hello")

        self.assertEqual(task.input_text, "hello")
        self.assertEqual(task.output_text, "hi back")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(task)
        db.rollback.assert_not_called()

    def test_build_outbound_message_send_payload_wraps_message_and_metadata(self):
        payload = self.a2a.build_outbound_message_send_payload(
            " hello ",
            "https://source.example/agent",
            request_id="req-1",
        )

        self.assertEqual(payload["jsonrpc"], "2.0")
        self.assertEqual(payload["id"], "req-1")
        self.assertEqual(payload["method"], "message/send")
        self.assertEqual(
            payload["params"]["message"]["parts"][0]["text"],
            "hello",
        )
        self.assertEqual(
            payload["params"]["metadata"]["sourceAgentUrl"],
            "https://source.example/agent",
        )

    def test_build_outbound_message_send_payload_embeds_pet_action_metadata(self):
        action_data = self.a2a.AgentActionPayload(
            action="pounce",
            emotion="excited",
            body_language="tail_up",
            vocalization="meow",
        )

        payload = self.a2a.build_outbound_message_send_payload(
            "hello",
            "https://source.example/agent",
            action_data=action_data,
            request_id="req-2",
        )

        self.assertIn("metadata", payload["params"])
        self.assertEqual(
            payload["params"]["metadata"]["sourceAgentUrl"],
            "https://source.example/agent",
        )
        self.assertEqual(
            json.loads(payload["params"]["metadata"]["petAction"]),
            {
                "action": "pounce",
                "emotion": "excited",
                "body_language": "tail_up",
                "vocalization": "meow",
            },
        )

    def test_build_outbound_message_send_payload_accepts_dict_style_action_object(self):
        action_data = types.SimpleNamespace(
            dict=lambda: {
                "action": "pounce",
                "emotion": "excited",
                "body_language": "tail_up",
                "vocalization": "meow",
            }
        )

        payload = self.a2a.build_outbound_message_send_payload(
            "hello",
            action_data=action_data,
        )

        self.assertEqual(
            json.loads(payload["params"]["metadata"]["petAction"]),
            {
                "action": "pounce",
                "emotion": "excited",
                "body_language": "tail_up",
                "vocalization": "meow",
            },
        )

    def test_build_outbound_message_send_payload_rejects_invalid_action_payload(self):
        action_data = types.SimpleNamespace(
            dict=lambda: {
                "action": "pounce",
                "emotion": "excited",
                "body_language": "tail_up",
                "vocalization": None,
            }
        )

        with self.assertRaises(self.http_exception) as context:
            self.a2a.build_outbound_message_send_payload(
                "hello",
                action_data=action_data,
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("vocalization", context.exception.detail)

    def test_build_outbound_message_send_payload_rejects_non_object_json(self):
        action_data = types.SimpleNamespace(json=lambda: '["bad"]')

        with self.assertRaises(self.http_exception) as context:
            self.a2a.build_outbound_message_send_payload(
                "hello",
                action_data=action_data,
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("serialize to an object", context.exception.detail)

    def test_parse_outbound_message_send_response_reads_task_summary(self):
        parsed = self.a2a.parse_outbound_message_send_response(
            {
                "jsonrpc": "2.0",
                "id": "req-1",
                "result": {
                    "task": {
                        "id": "task-1",
                        "state": "completed",
                        "message": {
                            "role": "agent",
                            "parts": [
                                {
                                    "type": "text",
                                    "text": "remote-reply",
                                }
                            ],
                        },
                    }
                },
            }
        )

        self.assertEqual(parsed["id"], "task-1")
        self.assertEqual(parsed["state"], "completed")
        self.assertEqual(parsed["replyText"], "remote-reply")

    def test_send_message_to_external_a2a_agent_posts_json_rpc_request(self):
        with patch.object(
            self.a2a,
            "urlopen",
            return_value=FakeHttpResponse(
                {
                    "jsonrpc": "2.0",
                    "id": "req-1",
                    "result": {
                        "task": {
                            "id": "task-remote",
                            "state": "completed",
                            "artifacts": [
                                {
                                    "parts": [
                                        {
                                            "type": "text",
                                            "text": "remote hello",
                                        }
                                    ]
                                }
                            ],
                        }
                    },
                }
            ),
        ) as mock_urlopen:
            parsed = self.a2a.send_message_to_external_a2a_agent(
                "https://remote.example/a2a/pets/9",
                "hello remote",
                "https://source.example/agent",
                request_id="req-1",
            )

        request = mock_urlopen.call_args.args[0]
        timeout = mock_urlopen.call_args.kwargs["timeout"]

        self.assertEqual(request.full_url, "https://remote.example/a2a/pets/9")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(timeout, self.a2a.A2A_HTTP_TIMEOUT_SECONDS)

        request_payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request_payload["method"], "message/send")
        self.assertEqual(
            request_payload["params"]["message"]["parts"][0]["text"],
            "hello remote",
        )
        self.assertEqual(parsed["id"], "task-remote")
        self.assertEqual(parsed["replyText"], "remote hello")

    def test_send_message_to_external_a2a_agent_maps_remote_error_to_http_exception(self):
        with patch.object(
            self.a2a,
            "urlopen",
            return_value=FakeHttpResponse(
                {
                    "jsonrpc": "2.0",
                    "id": "req-1",
                    "error": {
                        "code": -32000,
                        "message": "Remote agent refused the message.",
                    },
                }
            ),
        ):
            with self.assertRaises(self.http_exception) as context:
                self.a2a.send_message_to_external_a2a_agent(
                    "https://remote.example/a2a/pets/9",
                    "hello remote",
                    request_id="req-1",
                )

        self.assertEqual(context.exception.status_code, 502)
        self.assertIn("Remote agent refused the message.", context.exception.detail)

    def test_send_message_to_external_a2a_agent_maps_timeout_to_http_exception(self):
        with patch.object(self.a2a, "urlopen", side_effect=TimeoutError):
            with self.assertRaises(self.http_exception) as context:
                self.a2a.send_message_to_external_a2a_agent(
                    "https://remote.example/a2a/pets/9",
                    "hello remote",
                    request_id="req-1",
                )

        self.assertEqual(context.exception.status_code, 502)
        self.assertEqual(
            context.exception.detail,
            "External A2A agent request timed out.",
        )

    def test_create_outbound_a2a_task_for_pet_persists_remote_result(self):
        db = types.SimpleNamespace(
            add=MagicMock(),
            commit=MagicMock(),
            refresh=MagicMock(),
            rollback=MagicMock(),
        )
        pet = types.SimpleNamespace(id=7)

        with patch.object(
            self.a2a,
            "send_message_to_external_a2a_agent",
            return_value={
                "id": "task-remote",
                "state": "completed",
                "replyText": "remote hello",
                "task": {"id": "task-remote"},
            },
        ):
            task, remote_result = self.a2a.create_outbound_a2a_task_for_pet(
                db,
                pet,
                "https://remote.example/a2a/pets/9",
                "hello remote",
                source_agent_url="https://local.example/a2a/pets/7/agent.json",
            )

        self.assertEqual(task.target_pet_id, 7)
        self.assertEqual(task.state, "completed")
        self.assertEqual(task.input_text, "hello remote")
        self.assertEqual(task.output_text, "remote hello")
        self.assertEqual(task.a2a_task_id, "task-remote")
        self.assertEqual(task.source_agent_url, "https://remote.example/a2a/pets/9")
        self.assertEqual(remote_result["state"], "completed")
        db.add.assert_called_once_with(task)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(task)
        db.rollback.assert_not_called()

    def test_create_outbound_a2a_task_for_pet_persists_failed_task_for_upstream_error(self):
        db = types.SimpleNamespace(
            add=MagicMock(),
            commit=MagicMock(),
            refresh=MagicMock(),
            rollback=MagicMock(),
        )
        pet = types.SimpleNamespace(id=7)

        with patch.object(
            self.a2a,
            "send_message_to_external_a2a_agent",
            side_effect=self.http_exception(
                status_code=502,
                detail="External A2A agent is unreachable.",
            ),
        ):
            task, remote_result = self.a2a.create_outbound_a2a_task_for_pet(
                db,
                pet,
                "https://remote.example/a2a/pets/9",
                "hello remote",
                source_agent_url="https://local.example/a2a/pets/7/agent.json",
            )

        self.assertEqual(task.state, "failed")
        self.assertEqual(task.output_text, "External A2A agent is unreachable.")
        self.assertIsNone(task.a2a_task_id)
        self.assertEqual(remote_result["state"], "failed")
        self.assertEqual(remote_result["replyText"], "External A2A agent is unreachable.")
        db.add.assert_called_once_with(task)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(task)
        db.rollback.assert_not_called()


if __name__ == "__main__":
    unittest.main()
