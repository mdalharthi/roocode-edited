"""
API Provider model - stores configuration for AI API providers.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Integer,
    String,
    Text,
    DateTime,
    CheckConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ApiProvider(Base):
    """API Provider configuration table."""

    __tablename__ = "ca_api_providers"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Provider identification
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # API configuration
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auth_type: Mapped[str] = mapped_column(String(50), nullable=False, default="api_key")

    # Rate limiting
    rate_limit_requests_per_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    rate_limit_requests_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    rate_limit_requests_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=10000)

    # Configuration metadata (JSON)
    config_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=False, default=dict)

    # Versioning and auditing
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint(
            provider_type.in_(
                [
                    "openai",
                    "anthropic",
                    "gemini",
                    "bedrock",
                    "vertex",
                    "mistral",
                    "groq",
                    "huggingface",
                    "ollama",
                    "lmstudio",
                    "openrouter",
                    "requesty",
                    "glama",
                    "unbound",
                    "litellm",
                    "claude-code",
                    "vscode-llm",
                    "cerebras",
                    "deepseek",
                    "moonshot",
                    "sambanova",
                    "xai",
                    "doubao",
                    "zai",
                    "fireworks",
                    "chutes",
                    "azure",
                    "custom",
                ]
            ),
            name="valid_provider_type",
        ),
        CheckConstraint(
            auth_type.in_(["api_key", "oauth", "bearer", "basic", "none"]),
            name="valid_auth_type",
        ),
        CheckConstraint(
            "rate_limit_requests_per_minute > 0 AND rate_limit_requests_per_hour > 0 AND rate_limit_requests_per_day > 0",
            name="valid_rate_limits",
        ),
    )

    def __repr__(self) -> str:
        return f"<ApiProvider(id={self.id}, name='{self.name}', type='{self.provider_type}')>"
