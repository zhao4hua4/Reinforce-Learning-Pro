from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration with sane defaults and deterministic leaning."""

    model_config = SettingsConfigDict(
        env_prefix="RLPRO_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    data_dir: str = Field("data", description="Root data directory")
    artifacts_dir: str = Field("data/artifacts", description="Generated cards and segments")
    processed_dir: str = Field("data/processed", description="Cleaned text output directory")
    llm_endpoint: str = Field(
        "http://127.0.0.1:8008/v1/chat/completions",
        description="Local HTTP endpoint for OpenVINO Qwen3-8B",
    )
    ov_model_dir: str = Field(
        "data/artifacts/models/Qwen2.5-7B-Instruct-int4-ov",
        description="Local OpenVINO model directory for Qwen (int4, 7B Instruct from Hugging Face)",
    )
    temperature: float = Field(0.1, description="Decoding temperature (keep near deterministic)")
    seed: int = Field(42, description="Global seed for reproducible runs")
    request_timeout: int = Field(60, description="LLM HTTP timeout in seconds")
    # NOTE: These defaults are hard-coded for demo purposes; remove or override before publishing.
    remote_api_key: str = Field("SAMPLE_API_KEY", description="API key for remote OpenAI-compatible endpoint (e.g., DashScope)")
    remote_base_url: str = Field("https://dashscope.aliyuncs.com/compatible-mode/v1", description="Base URL for remote OpenAI-compatible endpoint")
    remote_default_model: str = Field("qwen3-next-80b-a3b-instruct", description="Default remote model name (e.g., qwen3-next-80b-a3b-instruct)")


settings = Settings()
