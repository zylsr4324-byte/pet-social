import json
import logging
import os
from socket import timeout as SocketTimeout
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

DEFAULT_LLM_BASE_URL = "https://api.deepseek.com/v1"
LLM_BASE_URL_ENV = "LLM_BASE_URL"
LLM_API_KEY_ENV = "LLM_API_KEY"
LLM_MODEL_ENV = "LLM_MODEL"
LEGACY_OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
LEGACY_OPENAI_MODEL_ENV = "OPENAI_MODEL"
DEFAULT_LLM_MODEL = "deepseek-chat"
LLM_TIMEOUT_SECONDS = 30
LOG_BODY_PREVIEW_LIMIT = 1000


def build_llm_chat_completions_url() -> str:
    base_url = os.getenv(LLM_BASE_URL_ENV, DEFAULT_LLM_BASE_URL).strip()

    if not base_url:
        base_url = DEFAULT_LLM_BASE_URL

    normalized_base_url = base_url.rstrip("/")

    if normalized_base_url.endswith("/chat/completions"):
        return normalized_base_url

    return f"{normalized_base_url}/chat/completions"


def read_llm_api_key() -> str:
    return os.getenv(LLM_API_KEY_ENV, "").strip() or os.getenv(
        LEGACY_OPENAI_API_KEY_ENV, ""
    ).strip()


def read_llm_model() -> str:
    return os.getenv(LLM_MODEL_ENV, "").strip() or os.getenv(
        LEGACY_OPENAI_MODEL_ENV, DEFAULT_LLM_MODEL
    ).strip()


def normalize_chat_messages(
    input_messages: list[dict[str, str]],
) -> list[dict[str, str]]:
    normalized_messages: list[dict[str, str]] = []

    for item in input_messages:
        if not isinstance(item, dict):
            continue

        content = item.get("content")
        if not isinstance(content, str):
            continue

        normalized_content = content.strip()
        if not normalized_content:
            continue

        role = str(item.get("role", "user")).strip().lower()
        if role == "developer":
            role = "system"
        elif role not in {"system", "user", "assistant", "tool"}:
            role = "user"

        normalized_messages.append(
            {
                "role": role,
                "content": normalized_content,
            }
        )

    if not normalized_messages:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="模型输入为空，暂时无法调用模型。",
        )

    return normalized_messages


def extract_upstream_error_message(response_payload: object) -> str:
    if not isinstance(response_payload, dict):
        return ""

    error_payload = response_payload.get("error")

    if not isinstance(error_payload, dict):
        return ""

    message = error_payload.get("message")

    if isinstance(message, str):
        return message.strip()

    return ""


def _extract_message_content_text(content: object) -> str:
    if isinstance(content, str):
        return content.strip()

    if not isinstance(content, list):
        return ""

    text_parts: list[str] = []
    for item in content:
        if not isinstance(item, dict):
            continue

        item_type = item.get("type")
        item_text = item.get("text")

        if item_type == "text" and isinstance(item_text, str) and item_text.strip():
            text_parts.append(item_text.strip())

    return "\n".join(text_parts).strip()


def extract_response_text(response_payload: object) -> str:
    upstream_error_message = extract_upstream_error_message(response_payload)

    if upstream_error_message:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"模型调用失败：{upstream_error_message}",
        )

    if not isinstance(response_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型返回的数据格式不正确。",
        )

    choices = response_payload.get("choices")

    if not isinstance(choices, list) or not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型返回的数据结构不完整。",
        )

    for choice in choices:
        if not isinstance(choice, dict):
            continue

        message = choice.get("message")
        if not isinstance(message, dict):
            continue

        reply_text = _extract_message_content_text(message.get("content"))
        if not reply_text:
            continue

        if len(reply_text) <= 500:
            return reply_text

        return f"{reply_text[:497]}..."

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="模型没有返回可用的回复内容。",
    )


def truncate_for_log(text: str, limit: int = LOG_BODY_PREVIEW_LIMIT) -> str:
    cleaned_text = text.strip()

    if len(cleaned_text) <= limit:
        return cleaned_text

    return f"{cleaned_text[:limit]}...(truncated)"


def log_llm_failure(
    *,
    event: str,
    url: str,
    model: str,
    api_key_configured: bool,
    error: BaseException,
    status_code: int | None = None,
    response_body: str | None = None,
) -> None:
    logger.error(
        (
            "LLM request failed | event=%s | url=%s | model=%s | "
            "api_key_configured=%s | status_code=%s | error_type=%s | error=%s | "
            "body=%s"
        ),
        event,
        url,
        model,
        api_key_configured,
        status_code,
        type(error).__name__,
        str(error),
        truncate_for_log(response_body or ""),
    )


def request_llm_reply(input_messages: list[dict[str, str]]) -> str:
    api_key = read_llm_api_key()
    api_key_configured = bool(api_key)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"后端没有配置 {LLM_API_KEY_ENV}，暂时无法调用模型。",
        )

    model = read_llm_model() or DEFAULT_LLM_MODEL
    llm_url = build_llm_chat_completions_url()
    request_payload = {
        "model": model,
        "messages": normalize_chat_messages(input_messages),
        "max_tokens": 120,
    }
    request_body = json.dumps(request_payload).encode("utf-8")
    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    llm_request = Request(
        llm_url,
        data=request_body,
        headers=request_headers,
        method="POST",
    )

    response_text = ""

    try:
        with urlopen(llm_request, timeout=LLM_TIMEOUT_SECONDS) as response:
            response_text = response.read().decode("utf-8", errors="ignore")
            response_payload = json.loads(response_text)
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="ignore")
        log_llm_failure(
            event="http_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
            status_code=error.code,
            response_body=error_body,
        )

        try:
            error_payload = json.loads(error_body)
        except json.JSONDecodeError:
            error_payload = None

        upstream_message = extract_upstream_error_message(error_payload)
        detail = (
            f"模型调用失败：{upstream_message}"
            if upstream_message
            else "模型调用失败，请稍后再试。"
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from error
    except (SocketTimeout, TimeoutError) as error:
        log_llm_failure(
            event="timeout",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型请求超时了，请稍后再试。",
        ) from error
    except URLError as error:
        log_llm_failure(
            event="url_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型服务暂时不可用，请稍后再试。",
        ) from error
    except json.JSONDecodeError as error:
        log_llm_failure(
            event="json_decode_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
            response_body=response_text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型返回的数据格式不正确。",
        ) from error
    except Exception as error:
        log_llm_failure(
            event="unexpected_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="模型调用失败，请稍后再试。",
        ) from error

    try:
        return extract_response_text(response_payload)
    except HTTPException as error:
        log_llm_failure(
            event="upstream_response_error",
            url=llm_url,
            model=model,
            api_key_configured=api_key_configured,
            error=error,
            response_body=response_text,
        )
        raise
