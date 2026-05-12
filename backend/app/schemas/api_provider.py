"""
Pydantic schemas for API Provider endpoints.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator

from app.schemas.common import PaginatedResponse


class ApiProviderBase(BaseModel):
    """Base API provider schema with common fields."""

    name: str = Field(..., min_length=1, max_length=100, description="Unique provider name")
    display_name: Optional[str] = Field(None, max_length=200, description="Display name")
    provider_type: str = Field(..., description="Provider type (openai, anthropic, etc.)")
    base_url: str = Field(..., description="API base URL")
    api_key_encrypted: Optional[str] = Field(None, description="API key (stored as plain text, field name kept for backward compatibility)")
    auth_type: str = Field(default="api_key", description="Authentication type")
    rate_limit_requests_per_minute: int = Field(default=60, gt=0, description="Requests per minute limit")
    rate_limit_requests_per_hour: int = Field(default=1000, gt=0, description="Requests per hour limit")
    rate_limit_requests_per_day: int = Field(default=10000, gt=0, description="Requests per day limit")
    config_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional configuration")

    @field_validator("provider_type")
    @classmethod
    def validate_provider_type(cls, v: str) -> str:
        """Validate provider type."""
        valid_types = [
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
        if v not in valid_types:
            raise ValueError(f"Invalid provider type. Must be one of: {', '.join(valid_types)}")
        return v

    @field_validator("auth_type")
    @classmethod
    def validate_auth_type(cls, v: str) -> str:
        """Validate auth type."""
        valid_types = ["api_key", "oauth", "bearer", "basic", "none"]
        if v not in valid_types:
            raise ValueError(f"Invalid auth type. Must be one of: {', '.join(valid_types)}")
        return v


class ApiProviderCreate(ApiProviderBase):
    """Schema for creating a new API provider."""

    created_by: Optional[str] = Field(None, max_length=100, description="Creator identifier")


class ApiProviderUpdate(BaseModel):
    """Schema for updating an API provider (all fields optional for partial updates)."""

    display_name: Optional[str] = Field(None, max_length=200)
    base_url: Optional[str] = None
    api_key_encrypted: Optional[str] = None
    auth_type: Optional[str] = None
    rate_limit_requests_per_minute: Optional[int] = Field(None, gt=0)
    rate_limit_requests_per_hour: Optional[int] = Field(None, gt=0)
    rate_limit_requests_per_day: Optional[int] = Field(None, gt=0)
    config_metadata: Optional[Dict[str, Any]] = None
    provider_type: Optional[str] = None
    updated_by: Optional[str] = Field(None, max_length=100)


class ApiProviderResponse(ApiProviderBase):
    """Schema for API provider response."""

    id: int = Field(..., description="Provider ID")
    version: int = Field(..., description="Version number")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator identifier")
    updated_by: Optional[str] = Field(None, description="Last updater identifier")

    class Config:
        from_attributes = True


class ApiProviderListResponse(BaseModel):
    """Schema for list of API providers with pagination."""

    providers: List[ApiProviderResponse] = Field(..., description="List of providers")
    total: int = Field(..., description="Total number of providers")
    limit: int = Field(..., description="Items per page")
    offset: int = Field(..., description="Offset from start")

    class Config:
        from_attributes = True
