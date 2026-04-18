from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.schemas import AgentActionPayload
from app.services import a2a, auto_social
from app.services.pet_stats import evaluate_social_intent


def build_pet(**overrides: object) -> SimpleNamespace:
    defaults = {
        "id": 1,
        "pet_name": "Mochi",
        "species": "cat",
        "personality": "quiet and reserved",
        "mood": "normal",
        "social_emotion": None,
        "social_action": None,
        "fullness": 80,
        "hydration": 80,
        "affection": 50,
        "energy": 80,
        "cleanliness": 80,
        "stats_updated_at": datetime.now(timezone.utc),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def build_mock_db_session(pets: list[SimpleNamespace]) -> MagicMock:
    pet_query = MagicMock()
    pet_query.all.return_value = pets

    quota_query = MagicMock()
    quota_query.filter.return_value.first.return_value = None

    db = MagicMock()

    def query_side_effect(model: object) -> MagicMock:
        if model is auto_social.Pet:
            return pet_query
        if model is auto_social.PetDailyQuota:
            return quota_query
        raise AssertionError(f"Unexpected model requested: {model!r}")

    db.query.side_effect = query_side_effect
    return db


def test_low_energy_pet_skips_llm_during_auto_social_tick() -> None:
    sleepy_pet = build_pet(energy=10, affection=15)

    assert evaluate_social_intent(sleepy_pet) == "ignore_social_and_rest"

    db = build_mock_db_session([sleepy_pet])
    recorded_task = SimpleNamespace(id=101)

    with patch.object(auto_social, "SessionLocal", return_value=db), patch.object(
        auto_social.random,
        "random",
        return_value=0.0,
    ), patch.object(
        auto_social,
        "_request_autonomous_action",
    ) as mock_llm_request, patch.object(
        auto_social,
        "create_social_task",
        return_value=recorded_task,
    ) as mock_create_task, patch.object(
        auto_social,
        "complete_social_task",
    ) as mock_complete_task, patch.object(
        auto_social,
        "apply_pet_social_presence",
    ) as mock_presence:
        auto_social.run_auto_social_tick()

    mock_llm_request.assert_not_called()
    mock_create_task.assert_called_once()
    mock_complete_task.assert_called_once()
    mock_presence.assert_called_once_with(
        sleepy_pet,
        emotion="calm",
        action="rest",
    )
    db.commit.assert_called_once()
    db.close.assert_called_once()


def test_build_outbound_message_send_payload_wraps_agent_action_metadata() -> None:
    action_data = AgentActionPayload(
        action="pounce",
        emotion="excited",
        body_language="tail_up",
        vocalization="meow",
    )

    with patch.object(a2a, "urlopen") as mock_urlopen:
        payload = a2a.build_outbound_message_send_payload(
            "hello",
            source_agent_url="https://source.example/agent",
            request_id="req-autonomous-1",
            action_data=action_data,
        )

    assert payload["jsonrpc"] == "2.0"
    assert payload["id"] == "req-autonomous-1"
    assert payload["method"] == "message/send"
    assert payload["params"]["message"]["role"] == "user"
    assert payload["params"]["message"]["parts"] == [
        {
            "type": "text",
            "text": "hello",
        }
    ]
    assert (
        payload["params"]["metadata"]["sourceAgentUrl"]
        == "https://source.example/agent"
    )

    pet_action = json.loads(payload["params"]["metadata"]["petAction"])
    assert pet_action["action"] == "pounce"
    assert pet_action["body_language"] == "tail_up"
    assert pet_action["emotion"] == "excited"
    assert pet_action["vocalization"] == "meow"

    mock_urlopen.assert_not_called()
