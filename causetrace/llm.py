"""Minimal client for a local Ollama server. No cloud services are contacted."""

import json
import re
from typing import Any, Dict, Optional

import httpx

from . import config


class LLMUnavailable(Exception):
    """Ollama is not reachable, or the configured model is not installed."""


class LLMBadOutput(Exception):
    """The model answered, but not with usable JSON."""


_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)


class OllamaClient:
    def __init__(self, base_url: str = config.OLLAMA_URL, model: str = config.OLLAMA_MODEL) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    def status(self) -> Dict[str, Any]:
        """Report reachability and whether the configured model is installed."""
        info = {"model": self.model, "reachable": False, "model_installed": False, "error": None}
        try:
            response = httpx.get(self.base_url + "/api/tags", timeout=config.OLLAMA_STATUS_TIMEOUT_S)
            response.raise_for_status()
            names = [m.get("name", "") for m in response.json().get("models", [])]
        except Exception as exc:  # network errors and malformed replies are all "unavailable"
            info["error"] = "Ollama is not reachable at {} ({}).".format(self.base_url, type(exc).__name__)
            return info
        info["reachable"] = True
        info["model_installed"] = any(n == self.model or n.split(":")[0] == self.model for n in names)
        if not info["model_installed"]:
            info["error"] = "Model {!r} is not installed. Run: ollama pull {}".format(self.model, self.model)
        return info

    def chat_json(self, system: str, user: str, schema: Dict[str, Any], max_tokens: int) -> Dict[str, Any]:
        """One non-streaming chat call whose output is constrained to a JSON schema."""
        payload = {
            "model": self.model,
            "stream": False,
            "think": False,
            "format": schema,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "options": {"temperature": 0, "num_ctx": config.OLLAMA_NUM_CTX, "num_predict": max_tokens},
        }
        try:
            response = httpx.post(
                self.base_url + "/api/chat", json=payload, timeout=config.OLLAMA_REQUEST_TIMEOUT_S
            )
            response.raise_for_status()
            content = response.json()["message"]["content"]
        except httpx.HTTPStatusError as exc:
            raise LLMUnavailable("Ollama returned HTTP {}.".format(exc.response.status_code)) from exc
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise LLMUnavailable("Ollama request failed ({}).".format(type(exc).__name__)) from exc

        content = _THINK_BLOCK.sub("", content).strip()
        try:
            parsed: Optional[Any] = json.loads(content)
        except ValueError as exc:
            raise LLMBadOutput("The model did not return valid JSON.") from exc
        if not isinstance(parsed, dict):
            raise LLMBadOutput("The model returned JSON that is not an object.")
        return parsed
