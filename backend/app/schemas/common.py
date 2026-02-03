"""
Common Pydantic schemas used across the application.
"""

from typing import Generic, TypeVar, List, Optional, Any, Dict
from pydantic import BaseModel, Field

# Generic type for paginated responses
T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""

    items: List[T] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    limit: int = Field(..., description="Items per page")
    offset: int = Field(..., description="Offset from start")

    class Config:
        from_attributes = True


class ErrorDetail(BaseModel):
    """Error detail schema."""

    field: Optional[str] = Field(None, description="Field that caused the error")
    message: str = Field(..., description="Error message")


class ErrorResponse(BaseModel):
    """Error response schema."""

    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Error message")
    details: List[ErrorDetail] = Field(default_factory=list, description="Error details")

    class Config:
        from_attributes = True
