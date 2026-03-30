from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.a2a import router
from app.database import get_db


def build_pet(pet_id: int = 7) -> SimpleNamespace:
    return SimpleNamespace(
        id=pet_id,
        pet_name="Mochi",
        species="cat",
        personality="curious",
    )


def build_task(
    *,
    task_id: str = "task-1",
    state: str = "completed",
    output_text: str = "hi back",
    source_agent_url: str | None = "https://source.example/agent",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        a2a_task_id=task_id,
        state=state,
        task_type="chat",
        target_pet_id=7,
        source_agent_url=source_agent_url,
        output_text=output_text,
        completed_at=None,
    )


class A2ARouteTests(unittest.TestCase):
    def setUp(self):
        self.db = object()
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_db] = self.override_get_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()

    def override_get_db(self):
        yield self.db

    def test_read_platform_agent_card_route_returns_discovery_payload(self):
        response = self.client.get("/.well-known/agent.json")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["name"], "Pet Agent Social")
        self.assertEqual(
            payload["url"],
            "http://testserver/.well-known/agent.json",
        )
        self.assertEqual(payload["capabilities"]["streaming"], False)

    def test_read_pet_agent_card_route_returns_pet_card(self):
        pet = build_pet()

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet) as mock_get_pet:
            response = self.client.get("/a2a/pets/7/agent.json")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["name"], "Mochi")
        self.assertEqual(payload["url"], "http://testserver/a2a/pets/7")
        self.assertEqual(payload["metadata"]["petId"], 7)
        mock_get_pet.assert_called_once_with(self.db, 7)

    def test_message_send_route_returns_serialized_task(self):
        pet = build_pet()
        task = build_task()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-1",
            "method": "message/send",
            "params": {
                "message": {
                    "parts": [
                        {
                            "type": "text",
                            "text": "hello from route",
                        }
                    ]
                },
                "metadata": {
                    "sourceAgentUrl": "https://source.example/agent",
                },
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.create_completed_a2a_task",
            return_value=task,
        ) as mock_create_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["jsonrpc"], "2.0")
        self.assertEqual(payload["id"], "req-1")
        self.assertEqual(payload["result"]["task"]["id"], "task-1")
        self.assertEqual(
            payload["result"]["task"]["message"]["parts"][0]["text"],
            "hi back",
        )
        mock_create_task.assert_called_once_with(
            self.db,
            pet,
            "hello from route",
            "https://source.example/agent",
        )

    def test_tasks_get_route_returns_existing_task(self):
        pet = build_pet()
        task = build_task()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-2",
            "method": "tasks/get",
            "params": {
                "taskId": "task-1",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
            return_value=task,
        ) as mock_get_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["jsonrpc"], "2.0")
        self.assertEqual(payload["id"], "req-2")
        self.assertEqual(payload["result"]["task"]["id"], "task-1")
        self.assertEqual(payload["result"]["task"]["state"], "completed")
        mock_get_task.assert_called_once_with(self.db, 7, "task-1")

    def test_tasks_cancel_route_cancels_pending_task(self):
        pet = build_pet()
        pending_task = build_task(state="pending", output_text="", source_agent_url=None)
        canceled_task = build_task(
            state="canceled",
            output_text="",
            source_agent_url=None,
        )
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-3",
            "method": "tasks/cancel",
            "params": {
                "taskId": "task-1",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
            return_value=pending_task,
        ), patch(
            "app.api.routes.a2a.cancel_a2a_task",
            return_value=canceled_task,
        ) as mock_cancel_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["jsonrpc"], "2.0")
        self.assertEqual(payload["id"], "req-3")
        self.assertEqual(payload["result"]["task"]["state"], "canceled")
        self.assertEqual(
            payload["result"]["task"]["status"]["state"],
            "canceled",
        )
        mock_cancel_task.assert_called_once_with(self.db, pending_task)

    def test_invalid_jsonrpc_version_returns_protocol_error(self):
        request_payload = {
            "jsonrpc": "1.0",
            "id": "req-invalid-version",
            "method": "message/send",
            "params": {
                "text": "hello",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404") as mock_get_pet:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32600)
        self.assertEqual(
            payload["error"]["message"],
            "Invalid JSON-RPC version.",
        )
        mock_get_pet.assert_not_called()

    def test_missing_method_returns_protocol_error(self):
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-missing-method",
            "params": {
                "text": "hello",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404") as mock_get_pet:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32600)
        self.assertEqual(payload["error"]["message"], "Missing method.")
        mock_get_pet.assert_not_called()

    def test_unsupported_method_returns_method_not_found_error(self):
        pet = build_pet()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-unsupported",
            "method": "tasks/list",
            "params": {},
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet) as mock_get_pet:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32601)
        self.assertEqual(
            payload["error"]["message"],
            "Unsupported method: tasks/list",
        )
        mock_get_pet.assert_called_once_with(self.db, 7)

    def test_message_send_without_text_returns_invalid_params_error(self):
        pet = build_pet()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-missing-text",
            "method": "message/send",
            "params": {
                "message": {
                    "parts": [],
                }
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.create_completed_a2a_task",
        ) as mock_create_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32602)
        self.assertEqual(
            payload["error"]["message"],
            "message/send requires a text message.",
        )
        mock_create_task.assert_not_called()

    def test_tasks_get_without_task_id_returns_invalid_params_error(self):
        pet = build_pet()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-get-missing-task",
            "method": "tasks/get",
            "params": {},
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
        ) as mock_get_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32602)
        self.assertEqual(payload["error"]["message"], "tasks/get requires taskId.")
        mock_get_task.assert_not_called()

    def test_tasks_get_missing_task_returns_not_found_error(self):
        pet = build_pet()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-get-not-found",
            "method": "tasks/get",
            "params": {
                "taskId": "task-missing",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
            return_value=None,
        ) as mock_get_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32004)
        self.assertEqual(payload["error"]["message"], "Task not found.")
        mock_get_task.assert_called_once_with(self.db, 7, "task-missing")

    def test_tasks_cancel_without_task_id_returns_invalid_params_error(self):
        pet = build_pet()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-cancel-missing-task",
            "method": "tasks/cancel",
            "params": {},
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
        ) as mock_get_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32602)
        self.assertEqual(
            payload["error"]["message"],
            "tasks/cancel requires taskId.",
        )
        mock_get_task.assert_not_called()

    def test_tasks_cancel_missing_task_returns_not_found_error(self):
        pet = build_pet()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-cancel-not-found",
            "method": "tasks/cancel",
            "params": {
                "taskId": "task-missing",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
            return_value=None,
        ) as mock_get_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32004)
        self.assertEqual(payload["error"]["message"], "Task not found.")
        mock_get_task.assert_called_once_with(self.db, 7, "task-missing")

    def test_tasks_cancel_rejects_non_pending_task(self):
        pet = build_pet()
        completed_task = build_task()
        request_payload = {
            "jsonrpc": "2.0",
            "id": "req-cancel-completed",
            "method": "tasks/cancel",
            "params": {
                "taskId": "task-1",
            },
        }

        with patch("app.api.routes.a2a.get_pet_or_404", return_value=pet), patch(
            "app.api.routes.a2a.get_a2a_task",
            return_value=completed_task,
        ), patch(
            "app.api.routes.a2a.cancel_a2a_task",
        ) as mock_cancel_task:
            response = self.client.post("/a2a/pets/7", json=request_payload)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], -32009)
        self.assertEqual(
            payload["error"]["message"],
            "Only pending tasks can be canceled.",
        )
        mock_cancel_task.assert_not_called()


if __name__ == "__main__":
    unittest.main()
