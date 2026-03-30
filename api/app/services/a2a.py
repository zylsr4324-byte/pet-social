from __future__ import annotations

import json
from datetime import datetime, timezone
from socket import timeout as SocketTimeout
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.models import Pet, PetTask
from app.services.pet_chat import create_pet_chat_turn
from app.services.pet_personality import infer_temperament_label

A2A_TASK_PREFIX = "task-"
A2A_JSON_RPC_VERSION = "2.0"
A2A_HTTP_TIMEOUT_SECONDS = 15


def build_json_rpc_error(
    request_id: str | int | None, code: int, message: str
) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {
            "code": code,
            "message": message,
        },
    }


def build_json_rpc_result(
    request_id: str | int | None, result: dict[str, Any]
) -> dict[str, Any]:
    return {
        "jsonrpc": A2A_JSON_RPC_VERSION,
        "id": request_id,
        "result": result,
    }


def build_platform_agent_card(request: Request) -> dict[str, Any]:
    base_url = str(request.base_url).rstrip("/")
    return {
        "name": "Pet Agent Social",
        "description": "A2A discovery entry for Pet Agent Social pets.",
        "url": f"{base_url}/.well-known/agent.json",
        "provider": {
            "organization": "Pet Agent Social",
        },
        "version": "0.4.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
        },
        "skills": [
            {
                "id": "pet-discovery",
                "name": "Pet Discovery",
                "description": "Discover pet-specific agent cards under /a2a/pets/{pet_id}/agent.json.",
            },
            {
                "id": "pet-chat",
                "name": "Pet Chat",
                "description": "Send a message to one pet through the A2A adapter.",
            },
        ],
    }


def build_pet_agent_card(request: Request, pet: Pet) -> dict[str, Any]:
    base_url = str(request.base_url).rstrip("/")
    temperament = infer_temperament_label(pet.personality)
    description = (
        f"{pet.pet_name} is a {pet.species} pet with {temperament} personality."
    )
    return {
        "name": pet.pet_name,
        "description": description,
        "url": f"{base_url}/a2a/pets/{pet.id}",
        "provider": {
            "organization": "Pet Agent Social",
        },
        "version": "0.4.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
        },
        "skills": [
            {
                "id": "chat",
                "name": "Chat",
                "description": "Talk with this pet and receive an in-character reply.",
            },
            {
                "id": "tasks-get",
                "name": "Task Status",
                "description": "Read the status and artifact of a previously completed chat task.",
            },
        ],
        "metadata": {
            "petId": pet.id,
            "species": pet.species,
            "personality": pet.personality,
        },
    }


def extract_message_text(params: dict[str, Any] | None) -> str | None:
    if not isinstance(params, dict):
        return None

    direct_text = params.get("text")
    if isinstance(direct_text, str) and direct_text.strip():
        return direct_text.strip()

    input_text = params.get("inputText")
    if isinstance(input_text, str) and input_text.strip():
        return input_text.strip()

    message = params.get("message")
    if not isinstance(message, dict):
        return None

    message_text = message.get("text")
    if isinstance(message_text, str) and message_text.strip():
        return message_text.strip()

    parts = message.get("parts")
    return extract_text_from_parts(parts)


def extract_task_id(params: dict[str, Any] | None) -> str | None:
    if not isinstance(params, dict):
        return None

    for key in ("taskId", "id"):
        value = params.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    task = params.get("task")
    if isinstance(task, dict):
        value = task.get("id")
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def extract_source_agent_url(params: dict[str, Any] | None) -> str | None:
    if not isinstance(params, dict):
        return None

    value = params.get("sourceAgentUrl")
    if isinstance(value, str) and value.strip():
        return value.strip()

    metadata = params.get("metadata")
    if not isinstance(metadata, dict):
        return None

    value = metadata.get("sourceAgentUrl")
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def extract_text_from_parts(parts: Any) -> str | None:
    if not isinstance(parts, list):
        return None

    for part in parts:
        if not isinstance(part, dict):
            continue
        if part.get("type") != "text":
            continue

        text = part.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()

    return None


def extract_task_reply_text(task: dict[str, Any] | None) -> str | None:
    if not isinstance(task, dict):
        return None

    message = task.get("message")
    if isinstance(message, dict):
        direct_text = message.get("text")
        if isinstance(direct_text, str) and direct_text.strip():
            return direct_text.strip()

        message_text = extract_text_from_parts(message.get("parts"))
        if message_text:
            return message_text

    artifacts = task.get("artifacts")
    if not isinstance(artifacts, list):
        return None

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue

        artifact_text = extract_text_from_parts(artifact.get("parts"))
        if artifact_text:
            return artifact_text

    return None


def extract_json_rpc_error_message(response_payload: Any) -> str | None:
    if not isinstance(response_payload, dict):
        return None

    error_payload = response_payload.get("error")
    if not isinstance(error_payload, dict):
        return None

    message = error_payload.get("message")
    if isinstance(message, str) and message.strip():
        return message.strip()

    return None


def build_outbound_message_send_payload(
    message_text: str,
    source_agent_url: str | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    normalized_message_text = message_text.strip()

    if not normalized_message_text:
        raise HTTPException(
            status_code=400,
            detail="External A2A message content cannot be empty.",
        )

    if len(normalized_message_text) > 500:
        raise HTTPException(
            status_code=400,
            detail="External A2A message content must be 500 characters or fewer.",
        )

    params: dict[str, Any] = {
        "message": {
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "text": normalized_message_text,
                }
            ],
        }
    }

    normalized_source_agent_url = (source_agent_url or "").strip()
    if normalized_source_agent_url:
        params["metadata"] = {"sourceAgentUrl": normalized_source_agent_url}

    return {
        "jsonrpc": A2A_JSON_RPC_VERSION,
        "id": request_id or f"req-{uuid4()}",
        "method": "message/send",
        "params": params,
    }


def parse_outbound_message_send_response(
    response_payload: Any,
) -> dict[str, Any]:
    if not isinstance(response_payload, dict):
        raise HTTPException(
            status_code=502,
            detail="External A2A agent returned an invalid payload.",
        )

    error_message = extract_json_rpc_error_message(response_payload)
    if error_message:
        raise HTTPException(
            status_code=502,
            detail=f"External A2A agent returned an error: {error_message}",
        )

    if response_payload.get("jsonrpc") != A2A_JSON_RPC_VERSION:
        raise HTTPException(
            status_code=502,
            detail="External A2A agent returned an invalid JSON-RPC response.",
        )

    result = response_payload.get("result")
    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="External A2A agent response is missing result.",
        )

    task = result.get("task")
    if not isinstance(task, dict):
        raise HTTPException(
            status_code=502,
            detail="External A2A agent response is missing task.",
        )

    task_id = task.get("id")
    if not isinstance(task_id, str) or not task_id.strip():
        raise HTTPException(
            status_code=502,
            detail="External A2A agent task is missing id.",
        )

    task_state = task.get("state")
    if not isinstance(task_state, str) or not task_state.strip():
        status_payload = task.get("status")
        if isinstance(status_payload, dict):
            task_state = status_payload.get("state")

    if not isinstance(task_state, str) or not task_state.strip():
        raise HTTPException(
            status_code=502,
            detail="External A2A agent task is missing state.",
        )

    return {
        "id": task_id.strip(),
        "state": task_state.strip(),
        "replyText": extract_task_reply_text(task),
        "task": task,
    }


def send_message_to_external_a2a_agent(
    agent_url: str,
    message_text: str,
    source_agent_url: str | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    normalized_agent_url = agent_url.strip()
    if not normalized_agent_url:
        raise HTTPException(
            status_code=400,
            detail="External A2A agent URL cannot be empty.",
        )

    request_payload = build_outbound_message_send_payload(
        message_text,
        source_agent_url,
        request_id=request_id,
    )
    request_body = json.dumps(request_payload).encode("utf-8")
    request = UrlRequest(
        normalized_agent_url,
        data=request_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    response_text = ""

    try:
        with urlopen(request, timeout=A2A_HTTP_TIMEOUT_SECONDS) as response:
            response_text = response.read().decode("utf-8", errors="ignore")
            response_payload = json.loads(response_text)
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="ignore")

        try:
            error_payload = json.loads(error_body)
        except json.JSONDecodeError:
            error_payload = None

        error_message = extract_json_rpc_error_message(error_payload)
        detail = (
            f"External A2A agent returned HTTP {error.code}: {error_message}"
            if error_message
            else f"External A2A agent returned HTTP {error.code}."
        )
        raise HTTPException(status_code=502, detail=detail) from error
    except (SocketTimeout, TimeoutError) as error:
        raise HTTPException(
            status_code=502,
            detail="External A2A agent request timed out.",
        ) from error
    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail="External A2A agent is unreachable.",
        ) from error
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=502,
            detail="External A2A agent returned invalid JSON.",
        ) from error

    return parse_outbound_message_send_response(response_payload)


def map_external_a2a_state_to_pet_task_state(state: str) -> str:
    normalized_state = state.strip().lower()

    if normalized_state == "completed":
        return "completed"

    if normalized_state == "failed":
        return "failed"

    if normalized_state in {"canceled", "cancelled"}:
        return "canceled"

    return "pending"


def create_outbound_a2a_task_for_pet(
    db: Session,
    pet: Pet,
    agent_url: str,
    message_text: str,
    source_agent_url: str | None = None,
) -> tuple[PetTask, dict[str, Any]]:
    normalized_agent_url = agent_url.strip()
    normalized_message_text = message_text.strip()

    if not normalized_agent_url:
        raise HTTPException(
            status_code=400,
            detail="External A2A agent URL cannot be empty.",
        )

    if not normalized_message_text:
        raise HTTPException(
            status_code=400,
            detail="External A2A message content cannot be empty.",
        )

    try:
        remote_result = send_message_to_external_a2a_agent(
            normalized_agent_url,
            normalized_message_text,
            source_agent_url=source_agent_url,
        )
        task_state = map_external_a2a_state_to_pet_task_state(remote_result["state"])
        output_text = remote_result["replyText"]
        task_id = remote_result["id"]
    except HTTPException as exc:
        if exc.status_code < 500:
            raise

        remote_result = {
            "id": None,
            "state": "failed",
            "replyText": str(exc.detail),
            "task": None,
        }
        task_state = "failed"
        output_text = str(exc.detail)
        task_id = None

    completed_at = None
    if task_state != "pending":
        completed_at = datetime.now(timezone.utc)

    task = PetTask(
        target_pet_id=pet.id,
        source_pet_id=None,
        task_type="chat",
        state=task_state,
        input_text=normalized_message_text,
        output_text=output_text,
        a2a_task_id=task_id,
        source_agent_url=normalized_agent_url,
        completed_at=completed_at,
    )

    try:
        db.add(task)
        db.commit()
        db.refresh(task)
        return task, remote_result
    except Exception:
        db.rollback()
        raise


def create_completed_a2a_task(
    db: Session,
    pet: Pet,
    message_text: str,
    source_agent_url: str | None = None,
) -> PetTask:
    try:
        user_message, pet_message = create_pet_chat_turn(db, pet, message_text)
        now = datetime.now(timezone.utc)
        task = PetTask(
            target_pet_id=pet.id,
            source_pet_id=None,
            task_type="chat",
            state="completed",
            input_text=user_message.content,
            output_text=pet_message.content,
            a2a_task_id=f"{A2A_TASK_PREFIX}{uuid4()}",
            source_agent_url=source_agent_url,
            completed_at=now,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    except Exception:
        db.rollback()
        raise


def get_a2a_task(
    db: Session, pet_id: int, a2a_task_id: str
) -> PetTask | None:
    return (
        db.query(PetTask)
        .filter(
            PetTask.target_pet_id == pet_id,
            PetTask.a2a_task_id == a2a_task_id,
        )
        .first()
    )


def cancel_a2a_task(db: Session, task: PetTask) -> PetTask:
    task.state = "canceled"
    if task.completed_at is None:
        task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def map_task_state(state: str) -> str:
    if state == "pending":
        return "submitted"
    if state == "failed":
        return "failed"
    if state == "canceled":
        return "canceled"
    return "completed"


def serialize_a2a_task(task: PetTask) -> dict[str, Any]:
    a2a_state = map_task_state(task.state)
    text_part = {
        "type": "text",
        "text": task.output_text or "",
    }
    return {
        "id": task.a2a_task_id or f"{A2A_TASK_PREFIX}{task.id}",
        "kind": "task",
        "state": a2a_state,
        "status": {
            "state": a2a_state,
        },
        "metadata": {
            "taskType": task.task_type,
            "targetPetId": task.target_pet_id,
            "sourceAgentUrl": task.source_agent_url,
        },
        "artifacts": [
            {
                "name": "reply",
                "parts": [text_part],
            }
        ],
        "message": {
            "role": "agent",
            "parts": [text_part],
        },
    }
