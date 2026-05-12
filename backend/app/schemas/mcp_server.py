"""
Pydantic schemas for MCP Server configuration endpoints.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class McpServerBase(BaseModel):
    """Base MCP server schema with common fields."""
    name: str = Field(..., min_length=1, max_length=100, description="Unique server name")
    config: Dict[str, Any] = Field(default_factory=dict, description="Server configuration (type, url, command, etc.)")


class McpServerCreate(McpServerBase):
    """Schema for creating a new MCP server."""
    created_by: Optional[str] = Field(None, max_length=100, description="Creator identifier")


class McpServerUpdate(BaseModel):
    """Schema for updating an MCP server (all fields optional for partial updates)."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    config: Optional[Dict[str, Any]] = None
    updated_by: Optional[str] = Field(None, max_length=100)


class McpServerResponse(McpServerBase):
    """Schema for MCP server response."""
    id: int = Field(..., description="Server ID")
    version: int = Field(..., description="Version number")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator identifier")
    updated_by: Optional[str] = Field(None, description="Last updater identifier")

    class Config:
        from_attributes = True


class McpServerListResponse(BaseModel):
    """Schema for list of MCP servers."""
    servers: List[McpServerResponse] = Field(..., description="List of servers")
    total: int = Field(..., description="Total number of servers")

    class Config:
        from_attributes = True
