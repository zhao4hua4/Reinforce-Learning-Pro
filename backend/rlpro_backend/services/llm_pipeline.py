from __future__ import annotations

import threading
from typing import Dict, Tuple

import openvino_genai as ov

from rlpro_backend.config import settings

# Local model presets: key -> path/device.
LOCAL_MODEL_PRESETS: Dict[str, Dict[str, str]] = {
    "local": {"model_dir": settings.ov_model_dir, "device": "CPU"},  # legacy alias
    "qwen2.5-1.5b-cpu": {"model_dir": "data/artifacts/models/qwen2.5-1.5b-int4-ov", "device": "CPU"},
    "qwen3-4b-cpu": {"model_dir": "data/artifacts/models/qwen3-4b-int4-ov", "device": "CPU"},
    "qwen3-4b-gpu": {"model_dir": "data/artifacts/models/qwen3-4b-int4-ov", "device": "GPU"},
    "qwen3-8b-cpu": {"model_dir": "data/artifacts/models/Qwen3-8B-int4-ov", "device": "CPU"},
    "qwen3-8b-gpu": {"model_dir": "data/artifacts/models/Qwen3-8B-int4-ov", "device": "GPU"},
    "qwen3-8b-npu": {"model_dir": "data/artifacts/models/Qwen3-8B-int4-cw-ov", "device": "NPU"},
    "qwen3-14b-gpu": {"model_dir": "data/artifacts/models/Qwen3-14B-int4-ov", "device": "GPU"},
}

_pipeline_lock = threading.Lock()
_pipelines: Dict[Tuple[str, str], ov.LLMPipeline] = {}


def _resolve_model(model_key: str | None) -> Tuple[str, str]:
    preset = LOCAL_MODEL_PRESETS.get(model_key or "") or {"model_dir": settings.ov_model_dir, "device": "CPU"}
    model_dir = str(preset.get("model_dir") or settings.ov_model_dir)
    device = preset.get("device") or "CPU"
    return model_dir, device


def get_pipeline(model_key: str | None = None) -> ov.LLMPipeline:
    """Load the OpenVINO LLM pipeline for the given preset (thread-safe, cached)."""
    model_dir, device = _resolve_model(model_key)
    cache_key = (model_dir, device)
    if cache_key not in _pipelines:
        with _pipeline_lock:
            if cache_key not in _pipelines:
                _pipelines[cache_key] = ov.LLMPipeline(model_dir, device=device)
    return _pipelines[cache_key]


def strip_think(text: str) -> str:
    """Remove <think>...</think> prefix if present."""
    if not text.startswith("<think>"):
        return text
    end_tag = "</think>"
    if end_tag in text:
        return text.split(end_tag, 1)[1].lstrip()
    return "\n".join(text.splitlines()[1:]).lstrip()


def collapse_deliberate(text: str) -> str:
    """If the model outputs deliberation prose, keep the last non-empty paragraph."""
    parts = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not parts:
        return text.strip()
    if len(parts) == 1:
        return parts[0]
    return parts[0]


def generate(
    prompt: str,
    max_new_tokens: int = 128,
    temperature: float | None = None,
    top_p: float = 0.9,
    model_key: str | None = None,
) -> str:
    pipe = get_pipeline(model_key)
    tokenizer = pipe.get_tokenizer()
    model_dir, _ = _resolve_model(model_key)
    use_qwen3 = "qwen3" in model_dir.lower()
    think_switch = "\n/nothink" if use_qwen3 else ""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a concise assistant. Answer directly and only give the final answer. "
                "Do not show reasoning or chain-of-thought. "
                "Respond in the user's language. "
                "Do not prepend phrases like '好的' or 'The user asked'; start directly with the answer.\n"
            ),
        },
        {"role": "user", "content": f"{prompt}{think_switch}"},
    ]
    prompt_text = tokenizer.apply_chat_template(messages, add_generation_prompt=True)

    stop_strings = set() if use_qwen3 else {"</think>"}
    gen_cfg = ov.GenerationConfig(
        max_new_tokens=max_new_tokens,
        temperature=temperature if temperature is not None else settings.temperature,
        top_p=top_p,
        do_sample=False,
        stop_strings=stop_strings,
        include_stop_str_in_output=False,
        ignore_eos=False,
    )
    raw = pipe.generate(prompt_text, generation_config=gen_cfg)
    cleaned = strip_think(raw)
    concise = collapse_deliberate(cleaned)
    fillers = ["好的。", "好的,", "好的", "用户让我", "用户要求", "The user asked", "The user wants"]
    for f in fillers:
        if concise.startswith(f):
            concise = concise[len(f) :].lstrip()
    for sep in ["。", ".", "!", "，", "?"]:
        if sep in concise:
            idx = concise.find(sep)
            if idx > 4:
                return concise[: idx + 1].strip()
    return concise.strip()
