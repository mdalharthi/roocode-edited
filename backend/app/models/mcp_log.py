"""
MCP Log model - specific logging for MCP server interactions.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, Float, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class McpLog(Base):
    """MCP log table for tracking interactions with MCP servers."""

    __tablename__ = "ca_mcp_logs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key
    action_log_id: Mapped[Optional[int]] = mapped_column(
        "action_log_id", Integer, ForeignKey("ca_action_logs.id"), nullable=True
    )

    # Session and identifiers
    session_id: Mapped[str] = mapped_column("session_id", String(255), nullable=False, index=True)

    # MCP specific details
    server_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    request_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True) # e.g. tool_call, read_resource, connection
    endpoint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # e.g. tool name, or resource URI
    
    # Payload details
    request_data: Mapped[Optional[dict]] = mapped_column("request_data", JSONB, nullable=True)
    response_data: Mapped[Optional[dict]] = mapped_column("response_data", JSONB, nullable=True)

    # Response status
    status_code: Mapped[Optional[int]] = mapped_column("status_code", Integer, nullable=True, index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column("duration_ms", Integer, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())

    # Relationship
    action_log: Mapped[Optional["ActionLog"]] = relationship("ActionLog", back_populates="mcp_logs")

    def __repr__(self) -> str:
        return f"<McpLog(id={self.id}, server_name='{self.server_name}', request_type='{self.request_type}', status={self.status_code})>"
