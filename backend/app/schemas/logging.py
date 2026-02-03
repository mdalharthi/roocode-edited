"""
Pydantic schemas for Logging API endpoints.
Covers all 5 logging types: Action, API, Performance, User Interaction, and File Operation logs.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# =====================
# Action Log Schemas
# =====================


class ActionLogBase(BaseModel):
    """Base schema for action log."""

    session_id: str = Field(..., max_length=255)
    user_id: Optional[str] = Field(None, max_length=255)
    workspace_id: Optional[str] = Field(None, max_length=255)
    action_type: str = Field(..., max_length=100)
    action_name: str = Field(..., max_length=255)
    status: Optional[str] = Field("pending", max_length=50)
    error_message: Optional[str] = None
    error_stack: Optional[str] = None
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    response_code: Optional[int] = None
    duration: Optional[int] = None
    action_metadata: Optional[dict] = Field(None, description="Action metadata as JSON")


class ActionLogCreate(ActionLogBase):
    """Schema for creating action log."""
    client_id: Optional[int] = None  # For batch correlation
    pass


class ActionLogUpdate(BaseModel):
    """Schema for updating action log."""

    status: Optional[str] = Field(None, max_length=50)
    error_message: Optional[str] = None
    error_stack: Optional[str] = None
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    response_code: Optional[int] = None
    duration: Optional[int] = None
    action_metadata: Optional[dict] = None

    # Optional completion interaction data - if provided, creates a user_interaction_log entry
    completion_interaction: Optional[dict] = Field(
        None,
        description="Optional completion interaction data. If provided and action_type is 'user_interaction', "
                    "creates a completion user_interaction_log entry with interaction_type from this field."
    )



class ActionLogResponse(ActionLogBase):
    """Schema for action log response."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActionLogListResponse(BaseModel):
    """Schema for paginated action log list."""

    logs: list[ActionLogResponse]
    total: int
    limit: int
    offset: int


# =====================
# API Log Schemas
# =====================


class ApiLogBase(BaseModel):
    """Base schema for API log."""

    session_id: str = Field(..., max_length=255)
    provider: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=255)
    endpoint: Optional[str] = Field(None, max_length=255)
    method: str = Field(..., max_length=10)
    url: Optional[str] = None
    status_code: Optional[int] = None
    request_headers: Optional[dict] = None
    request_body: Optional[dict | list | str] = None
    response_headers: Optional[dict] = None
    response_body: Optional[dict | list | str] = None
    error_message: Optional[str] = None
    duration_ms: Optional[int] = Field(None, ge=0)
    tokens_used: Optional[int] = Field(None, ge=0)
    cost: Optional[float] = Field(None, ge=0)
    retry_count: Optional[int] = Field(None, ge=0)


class ApiLogCreate(ApiLogBase):
    """Schema for creating API log."""
    action_log_id: Optional[int] = None
    client_action_log_id: Optional[int] = None  # For batch correlation
    pass


class ApiLogResponse(ApiLogBase):
    """Schema for API log response."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiLogListResponse(BaseModel):
    """Schema for paginated API log list."""

    logs: list[ApiLogResponse]
    total: int
    limit: int
    offset: int


# =====================
# Performance Log Schemas
# =====================


class PerformanceLogBase(BaseModel):
    """Base schema for performance log."""

    session_id: str = Field(..., max_length=255)
    operation_name: str = Field(..., max_length=255)
    operation_type: str = Field(..., max_length=100)
    duration_ms: float = Field(..., ge=0)
    cpu_usage: Optional[float] = Field(None, ge=0, le=100)
    memory_usage: Optional[int] = Field(None, ge=0)  # Memory usage in bytes
    memory_usage_mb: Optional[float] = Field(None, ge=0)
    file_size_bytes: Optional[int] = Field(None, ge=0)
    throughput: Optional[float] = Field(None, ge=0)
    action_log_id: Optional[int] = None
    resource_metrics: Optional[dict] = None  # Resource metrics as separate field
    additional_metrics: Optional[dict] = None


class PerformanceLogCreate(PerformanceLogBase):
    """Schema for creating performance log."""
    client_action_log_id: Optional[int] = None  # For batch correlation
    pass


class PerformanceLogResponse(PerformanceLogBase):
    """Schema for performance log response."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PerformanceLogListResponse(BaseModel):
    """Schema for paginated performance log list."""

    logs: list[PerformanceLogResponse]
    total: int
    limit: int
    offset: int


# =====================
# User Interaction Log Schemas
# =====================


class UserInteractionLogBase(BaseModel):
    """Base schema for user interaction log."""

    action_log_id: Optional[int] = None
    session_id: str = Field(..., max_length=255)
    user_id: Optional[str] = Field(None, max_length=255)
    interaction_type: str = Field(..., max_length=100)
    component: str = Field(..., max_length=255)
    action: Optional[str] = Field(None, max_length=100)
    result: Optional[str] = Field(None, max_length=255)
    context: Optional[dict] = None


class UserInteractionLogCreate(UserInteractionLogBase):
    """Schema for creating user interaction log."""
    client_action_log_id: Optional[int] = None  # For batch correlation
    pass


class UserInteractionLogResponse(UserInteractionLogBase):
    """Schema for user interaction log response."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserInteractionLogListResponse(BaseModel):
    """Schema for paginated user interaction log list."""

    logs: list[UserInteractionLogResponse]
    total: int
    limit: int
    offset: int


# =====================
# File Operation Log Schemas
# =====================


class FileOperationLogBase(BaseModel):
    """Base schema for file operation log."""

    session_id: str = Field(..., max_length=255)
    operation: str = Field(..., max_length=50)
    mode: str = Field("unknown", max_length=50)
    file_path: str = Field(..., max_length=500)
    file_size_bytes: Optional[int] = Field(None, ge=0)
    duration_ms: Optional[int] = Field(None, ge=0)
    success: bool = Field(default=True)
    error_message: Optional[str] = None
    file_metadata: Optional[dict] = None
    
    # Detailed metrics
    action_log_id: Optional[int] = None
    version_before: Optional[str] = Field(None, max_length=255)
    version_after: Optional[str] = Field(None, max_length=255)
    previous_total_lines: Optional[int] = Field(None, ge=0)
    new_total_lines: Optional[int] = Field(None, ge=0)
    new_lines_added: Optional[int] = Field(None, ge=0)
    lines_removed: Optional[int] = Field(None, ge=0)
    lines_modified: Optional[int] = Field(None, ge=0)
    non_empty_lines_before: Optional[int] = Field(None, ge=0)
    non_empty_lines_after: Optional[int] = Field(None, ge=0)
    content_type: Optional[str] = Field(None, max_length=100)


class FileOperationLogCreate(FileOperationLogBase):
    """Schema for creating file operation log."""
    client_action_log_id: Optional[int] = None  # For batch correlation
    pass


class FileOperationLogResponse(FileOperationLogBase):
    """Schema for file operation log response."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileOperationLogListResponse(BaseModel):
    """Schema for paginated file operation log list."""

    logs: list[FileOperationLogResponse]
    total: int
    limit: int
    offset: int


# =====================
# Batch Log Schemas
# =====================


class BatchLogCreate(BaseModel):
    """Schema for batch creating multiple logs at once."""

    action_logs: Optional[list[ActionLogCreate]] = None
    api_logs: Optional[list[ApiLogCreate]] = None
    performance_logs: Optional[list[PerformanceLogCreate]] = None
    user_interaction_logs: Optional[list[UserInteractionLogCreate]] = None
    file_operation_logs: Optional[list[FileOperationLogCreate]] = None


class BatchLogResponse(BaseModel):
    """Schema for batch log creation response."""

    action_logs_created: int = 0
    api_logs_created: int = 0
    performance_logs_created: int = 0
    user_interaction_logs_created: int = 0
    file_operation_logs_created: int = 0
    total_created: int = 0
    errors: list[str] = []
    id_map: Optional[dict[int, int]] = None  # Map of client_action_log_id to real action_log_id
