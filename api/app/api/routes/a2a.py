from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.a2a import (
    build_json_rpc_error,
    build_json_rpc_result,
    build_pet_agent_card,
    build_platform_agent_card,
    cancel_a2a_task,
    create_completed_a2a_task,
    extract_message_text,
    extract_source_agent_url,
    extract_task_id,
    get_a2a_task,
    serialize_a2a_task,
)
from app.services.pets import get_pet_or_404

router = APIRouter(tags=["a2a"])


@router.get("/.well-known/agent.json")
def read_platform_agent_card(request: Request) -> dict[str, Any]:
    return build_platform_agent_card(request)


@router.get("/a2a/pets/{pet_id}/agent.json")
def read_pet_agent_card(
    pet_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    pet = get_pet_or_404(db, pet_id)
    return build_pet_agent_card(request, pet)


@router.post("/a2a/pets/{pet_id}")
def handle_pet_a2a_request(
    pet_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    request_id = payload.get("id")
    if payload.get("jsonrpc") != "2.0":
        return build_json_rpc_error(request_id, -32600, "Invalid JSON-RPC version.")

    method = payload.get("method")
    if not isinstance(method, str) or not method:
        return build_json_rpc_error(request_id, -32600, "Missing method.")

    pet = get_pet_or_404(db, pet_id)
    params = payload.get("params")
    params_dict = params if isinstance(params, dict) else None

    if method == "message/send":
        message_text = extract_message_text(params_dict)
        if not message_text:
            return build_json_rpc_error(
                request_id, -32602, "message/send requires a text message."
            )
        if len(message_text) > 500:
            return build_json_rpc_error(
                request_id,
                -32602,
                "message/send text must be 500 characters or fewer.",
            )

        try:
            task = create_completed_a2a_task(
                db,
                pet,
                message_text,
                extract_source_agent_url(params_dict),
            )
        except HTTPException as exc:
            return build_json_rpc_error(request_id, -32000, str(exc.detail))

        return build_json_rpc_result(
            request_id,
            {
                "task": serialize_a2a_task(task),
            },
        )

    if method == "tasks/get":
        task_id = extract_task_id(params_dict)
        if not task_id:
            return build_json_rpc_error(
                request_id, -32602, "tasks/get requires taskId."
            )

        task = get_a2a_task(db, pet.id, task_id)
        if task is None:
            return build_json_rpc_error(request_id, -32004, "Task not found.")

        return build_json_rpc_result(
            request_id,
            {
                "task": serialize_a2a_task(task),
            },
        )

    if method == "tasks/cancel":
        task_id = extract_task_id(params_dict)
        if not task_id:
            return build_json_rpc_error(
                request_id, -32602, "tasks/cancel requires taskId."
            )

        task = get_a2a_task(db, pet.id, task_id)
        if task is None:
            return build_json_rpc_error(request_id, -32004, "Task not found.")

        if task.state != "pending":
            return build_json_rpc_error(
                request_id,
                -32009,
                "Only pending tasks can be canceled.",
            )

        return build_json_rpc_result(
            request_id,
            {
                "task": serialize_a2a_task(cancel_a2a_task(db, task)),
            },
        )

    return build_json_rpc_error(request_id, -32601, f"Unsupported method: {method}")
