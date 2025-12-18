from __future__ import annotations

from typing import Any, Dict

import httpx

from rlpro_backend.config import settings


class LLMClient:
    """HTTP client for the local OpenVINO Qwen3-8B service."""

    def __init__(self, endpoint: str | None = None, timeout: int | None = None):
        self.endpoint = endpoint or settings.llm_endpoint
        self.timeout = timeout or settings.request_timeout

    async def generate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send a raw payload to the local model. Placeholder for prompt shaping."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # Placeholder: shape payload to model-specific schema if needed.
            response = await client.post(self.endpoint, json=payload)
            response.raise_for_status()
        return response.json()

    async def generate_cards(self, prompt: str, *, temperature: float | None = None, seed: int | None = None) -> Dict[str, Any]:
        """Convenience wrapper for card generation prompts (not yet implemented)."""
        _ = temperature or settings.temperature
        _ = seed or settings.seed
        raise NotImplementedError("Card generation prompt/response shaping is not implemented yet.")
