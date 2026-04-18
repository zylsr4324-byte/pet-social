from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services import llm_client


class FakeHttpResponse:
    def __init__(self, body: dict[str, object]):
        self._body = json.dumps(body).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class LlmClientTests(unittest.TestCase):
    def test_build_llm_chat_completions_url_appends_endpoint(self):
        with patch.dict(
            os.environ,
            {"LLM_BASE_URL": "https://api.deepseek.com/v1"},
            clear=False,
        ):
            self.assertEqual(
                llm_client.build_llm_chat_completions_url(),
                "https://api.deepseek.com/v1/chat/completions",
            )

    def test_build_llm_chat_completions_url_keeps_full_endpoint(self):
        with patch.dict(
            os.environ,
            {"LLM_BASE_URL": "https://api.deepseek.com/chat/completions"},
            clear=False,
        ):
            self.assertEqual(
                llm_client.build_llm_chat_completions_url(),
                "https://api.deepseek.com/chat/completions",
            )

    def test_normalize_chat_messages_maps_developer_to_system(self):
        messages = llm_client.normalize_chat_messages(
            [
                {"role": "developer", "content": " rule "},
                {"role": "user", "content": " hi "},
                {"role": "unknown", "content": " fallback "},
            ]
        )

        self.assertEqual(
            messages,
            [
                {"role": "system", "content": "rule"},
                {"role": "user", "content": "hi"},
                {"role": "user", "content": "fallback"},
            ],
        )

    def test_extract_response_text_reads_chat_completion_shape(self):
        response = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "hello from deepseek",
                    }
                }
            ]
        }

        self.assertEqual(
            llm_client.extract_response_text(response),
            "hello from deepseek",
        )

    def test_extract_response_text_reads_content_parts(self):
        response = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": [
                            {"type": "text", "text": "first"},
                            {"type": "text", "text": "second"},
                        ],
                    }
                }
            ]
        }

        self.assertEqual(
            llm_client.extract_response_text(response),
            "first\nsecond",
        )

    def test_request_llm_reply_posts_deepseek_chat_completions_payload(self):
        with patch.dict(
            os.environ,
            {
                "LLM_BASE_URL": "https://api.deepseek.com/v1",
                "LLM_API_KEY": "deepseek-key",
                "LLM_MODEL": "deepseek-chat",
            },
            clear=False,
        ), patch.object(
            llm_client,
            "urlopen",
            return_value=FakeHttpResponse(
                {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "structured reply",
                            }
                        }
                    ]
                }
            ),
        ) as mock_urlopen:
            reply_text = llm_client.request_llm_reply(
                [
                    {"role": "developer", "content": "follow the rules"},
                    {"role": "user", "content": "say hi"},
                ]
            )

        self.assertEqual(reply_text, "structured reply")
        request = mock_urlopen.call_args.args[0]
        request_payload = json.loads(request.data.decode("utf-8"))

        self.assertEqual(
            request.full_url,
            "https://api.deepseek.com/v1/chat/completions",
        )
        self.assertEqual(request_payload["model"], "deepseek-chat")
        self.assertEqual(request_payload["max_tokens"], 120)
        self.assertEqual(
            request_payload["messages"],
            [
                {"role": "system", "content": "follow the rules"},
                {"role": "user", "content": "say hi"},
            ],
        )
        self.assertEqual(request.get_header("Authorization"), "Bearer deepseek-key")

    def test_request_llm_reply_requires_api_key(self):
        with patch.dict(
            os.environ,
            {
                "LLM_API_KEY": "",
                "OPENAI_API_KEY": "",
            },
            clear=False,
        ):
            with self.assertRaises(HTTPException) as context:
                llm_client.request_llm_reply(
                    [{"role": "user", "content": "hello"}]
                )

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("LLM_API_KEY", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
