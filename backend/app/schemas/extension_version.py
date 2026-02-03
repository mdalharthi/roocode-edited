"""
Pydantic schemas for Extension Version API endpoints.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ExtensionVersionBase(BaseModel):
    """Base schema for extension version."""

    extension_version: str = Field(..., max_length=50, description="Extension version string")
    schema_version: int = Field(default=1, ge=1, description="Database schema version")
    migration_hash: Optional[str] = Field(None, max_length=255, description="Migration hash for verification")


class ExtensionVersionCreate(ExtensionVersionBase):
    """Schema for creating a new version record."""
    pass


class ExtensionVersionUpdate(BaseModel):
    """Schema for updating version record (partial update)."""

    extension_version: Optional[str] = Field(None, max_length=50)
    schema_version: Optional[int] = Field(None, ge=1)
    migration_hash: Optional[str] = Field(None, max_length=255)
    last_synced_at: Optional[datetime] = None


class VersionLockRequest(BaseModel):
    """Schema for locking the database."""

    reason: Optional[str] = Field(None, description="Reason for locking")


class VersionUnlockRequest(BaseModel):
    """Schema for unlocking the database."""

    force: bool = Field(False, description="Force unlock even if locked by another process")


class VersionVerifyRequest(BaseModel):
    """Schema for verifying version match."""

    extension_version: str = Field(..., description="Extension version to verify")
    schema_version: Optional[int] = Field(None, description="Schema version to verify")


class ExtensionVersionResponse(ExtensionVersionBase):
    """Schema for version response."""

    id: int
    is_locked: bool
    locked_at: Optional[datetime] = None
    locked_reason: Optional[str] = None
    last_synced_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VersionStatusResponse(BaseModel):
    """Schema for version lock status."""

    is_locked: bool
    locked_at: Optional[datetime] = None
    locked_reason: Optional[str] = None
    extension_version: str
    schema_version: int

    model_config = ConfigDict(from_attributes=True)


class VersionVerifyResponse(BaseModel):
    """Schema for version verification response."""

    matches: bool
    is_locked: bool
    locked_at: Optional[datetime] = None
    locked_reason: Optional[str] = None
    current_version: str
    current_schema_version: int
    requested_version: str
    requested_schema_version: Optional[int] = None
    message: str
