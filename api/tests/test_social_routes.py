from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes.social import router
from app.database import get_db
from app.services.auth import get_current_user


class SocialRouteTests(unittest.TestCase):
    def setUp(self):
        self.db = object()
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_db] = self.override_get_db
        self.app.dependency_overrides[get_current_user] = self.override_get_current_user
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()

    def override_get_db(self):
        yield self.db

    def override_get_current_user(self):
        return SimpleNamespace(id=1)

    def test_delete_friendship_route_removes_existing_friendship(self):
        self.db = SimpleNamespace(
            delete=MagicMock(),
            commit=MagicMock(),
            rollback=MagicMock(),
        )
        source_pet = SimpleNamespace(id=7)
        friend_pet = SimpleNamespace(id=9, pet_name="Mochi")
        friendship = SimpleNamespace(status="accepted", initiated_by=9)
        friendship_payload = {
            "friend": {
                "id": 9,
                "petName": "Mochi",
                "species": "cat",
                "color": "white",
                "size": "small",
                "personality": "gentle",
                "specialTraits": "",
                "createdAt": "2026-03-29T00:00:00Z",
                "updatedAt": "2026-03-29T00:00:00Z",
            },
            "status": "accepted",
            "initiatedBy": 9,
            "direction": "accepted",
            "conversationId": 5,
            "lastMessagePreview": "hello",
            "createdAt": "2026-03-29T00:00:00Z",
            "acceptedAt": "2026-03-29T00:01:00Z",
        }

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.get_pet_or_404",
            return_value=friend_pet,
        ), patch(
            "app.api.routes.social.get_friendship_between",
            return_value=friendship,
        ), patch(
            "app.api.routes.social.build_friendship_response",
            return_value=friendship_payload,
        ):
            response = self.client.delete("/pets/7/friends/9")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["message"], "已将Mochi从好友列表移除。")
        self.assertEqual(payload["friendship"]["friend"]["id"], 9)
        self.db.delete.assert_called_once_with(friendship)
        self.db.commit.assert_called_once()
        self.db.rollback.assert_not_called()

    def test_delete_friendship_route_returns_not_found_when_missing(self):
        source_pet = SimpleNamespace(id=7)
        friend_pet = SimpleNamespace(id=9, pet_name="Mochi")

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.get_pet_or_404",
            return_value=friend_pet,
        ), patch(
            "app.api.routes.social.get_friendship_between",
            return_value=None,
        ):
            response = self.client.delete("/pets/7/friends/9")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "没有找到这条好友关系。")

    def test_request_friendship_route_blocks_recent_rejected_request(self):
        source_pet = SimpleNamespace(id=7)
        target_pet = SimpleNamespace(id=9, pet_name="Mochi")
        friendship = SimpleNamespace(
            status="rejected",
            initiated_by=7,
            created_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.get_pet_or_404",
            return_value=target_pet,
        ), patch(
            "app.api.routes.social.get_friendship_between",
            return_value=friendship,
        ), patch(
            "app.api.routes.social.get_or_create_conversation",
        ) as mock_get_conversation, patch(
            "app.api.routes.social.create_social_message",
        ) as mock_create_social_message:
            response = self.client.post(
                "/pets/7/friends/request",
                json={"targetPetId": 9, "message": "hello"},
            )

        self.assertEqual(response.status_code, 409)
        """
        self.assertIn(
            "24 小时内只能发起 1 次好友请求",
            response.json()["detail"],
        )
        """
        self.assertEqual(
            response.json()["detail"],
            "\u540c\u4e00\u5bf9\u5ba0\u7269 24 \u5c0f\u65f6\u5185\u53ea\u80fd\u53d1\u8d77 1 \u6b21\u597d\u53cb\u8bf7\u6c42\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002",
        )
        mock_get_conversation.assert_not_called()
        mock_create_social_message.assert_not_called()

    def test_request_friendship_route_reuses_rejected_friendship_after_cooldown(self):
        self.db = SimpleNamespace(commit=MagicMock(), rollback=MagicMock())
        source_pet = SimpleNamespace(id=7)
        target_pet = SimpleNamespace(id=9, pet_name="Mochi")
        original_created_at = datetime(2026, 3, 28, 0, 0, tzinfo=timezone.utc)
        friendship = SimpleNamespace(
            status="rejected",
            initiated_by=9,
            accepted_at=None,
            created_at=original_created_at,
        )
        conversation = SimpleNamespace(id=5)
        friendship_payload = {
            "friend": {
                "id": 9,
                "petName": "Mochi",
                "species": "cat",
                "color": "white",
                "size": "small",
                "personality": "gentle",
                "specialTraits": "",
                "createdAt": "2026-03-29T00:00:00Z",
                "updatedAt": "2026-03-29T00:00:00Z",
            },
            "status": "pending",
            "initiatedBy": 7,
            "direction": "outgoing",
            "conversationId": 5,
            "lastMessagePreview": "hello",
            "createdAt": "2026-03-30T00:00:00Z",
            "acceptedAt": None,
        }

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.get_pet_or_404",
            return_value=target_pet,
        ), patch(
            "app.api.routes.social.get_friendship_between",
            return_value=friendship,
        ), patch(
            "app.api.routes.social.get_or_create_conversation",
            return_value=conversation,
        ), patch(
            "app.api.routes.social.create_social_message",
        ) as mock_create_social_message, patch(
            "app.api.routes.social.build_friendship_response",
            return_value=friendship_payload,
        ):
            response = self.client.post(
                "/pets/7/friends/request",
                json={"targetPetId": 9, "message": "hello"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(friendship.status, "pending")
        self.assertEqual(friendship.initiated_by, 7)
        self.assertIsNone(friendship.accepted_at)
        self.assertNotEqual(friendship.created_at, original_created_at)
        mock_create_social_message.assert_called_once_with(
            self.db,
            5,
            7,
            "hello",
        )
        self.db.commit.assert_called_once()

    def test_run_social_round_route_returns_rate_limit_before_round_execution(self):
        self.db = SimpleNamespace(rollback=MagicMock())
        source_pet = SimpleNamespace(id=7)

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.consume_daily_social_initiation_quota",
            side_effect=HTTPException(
                status_code=429,
                detail="当前宠物今天已达到5次主动社交上限，请明天再试。",
            ),
        ), patch(
            "app.api.routes.social.choose_social_round_target",
        ) as mock_choose_target:
            response = self.client.post("/pets/7/social/round")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(
            response.json()["detail"],
            "当前宠物今天已达到5次主动社交上限，请明天再试。",
        )
        mock_choose_target.assert_not_called()

    def test_send_external_a2a_message_route_dispatches_and_returns_task_summary(self):
        source_pet = SimpleNamespace(id=7)
        persisted_task = SimpleNamespace(state="completed")
        task_payload = {
            "id": 11,
            "targetPetId": 7,
            "sourcePetId": None,
            "taskType": "chat",
            "state": "completed",
            "inputText": "hello remote",
            "outputText": "remote hello",
            "externalTaskId": "task-remote",
            "agentUrl": "https://remote.example/a2a/pets/9",
            "createdAt": "2026-03-29T00:00:00Z",
            "completedAt": "2026-03-29T00:00:05Z",
        }

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.create_outbound_a2a_task_for_pet",
            return_value=(
                persisted_task,
                {
                    "id": "task-remote",
                    "state": "completed",
                    "replyText": "remote hello",
                    "task": {"id": "task-remote"},
                },
            ),
        ) as mock_create_task, patch(
            "app.api.routes.social.build_pet_task_response",
            return_value=task_payload,
        ):
            response = self.client.post(
                "/pets/7/social/external/send",
                json={
                    "agentUrl": "https://remote.example/a2a/pets/9",
                    "message": "hello remote",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload["message"],
            "External A2A message dispatched and recorded.",
        )
        self.assertEqual(payload["task"]["id"], 11)
        self.assertEqual(payload["task"]["externalTaskId"], "task-remote")
        self.assertEqual(payload["task"]["agentUrl"], "https://remote.example/a2a/pets/9")
        self.assertEqual(payload["remote"]["agentUrl"], "https://remote.example/a2a/pets/9")
        self.assertEqual(payload["remote"]["taskId"], "task-remote")
        self.assertEqual(payload["remote"]["replyText"], "remote hello")
        mock_create_task.assert_called_once_with(
            self.db,
            source_pet,
            "https://remote.example/a2a/pets/9",
            "hello remote",
            source_agent_url="http://testserver/a2a/pets/7/agent.json",
        )

    def test_list_social_tasks_route_exposes_external_a2a_task_fields(self):
        source_pet = SimpleNamespace(id=7)
        task_history_item = {
            "task": {
                "id": 11,
                "targetPetId": 7,
                "sourcePetId": None,
                "taskType": "chat",
                "state": "completed",
                "inputText": "hello remote",
                "outputText": "remote hello",
                "externalTaskId": "task-remote",
                "agentUrl": "https://remote.example/a2a/pets/9",
                "createdAt": "2026-03-29T00:00:00Z",
                "completedAt": "2026-03-29T00:00:05Z",
            },
            "counterpartPet": None,
        }

        with patch(
            "app.api.routes.social.get_owned_pet_or_404",
            return_value=source_pet,
        ), patch(
            "app.api.routes.social.get_social_tasks_for_pet",
            return_value=[SimpleNamespace(id=11)],
        ), patch(
            "app.api.routes.social.build_social_task_history_item",
            return_value=task_history_item,
        ):
            response = self.client.get("/pets/7/social/tasks")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["tasks"][0]["task"]["externalTaskId"], "task-remote")
        self.assertEqual(
            payload["tasks"][0]["task"]["agentUrl"],
            "https://remote.example/a2a/pets/9",
        )


if __name__ == "__main__":
    unittest.main()
