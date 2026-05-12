"""
MCP Server Configuration model - stores settings for MCP server connections.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class McpServerConfig(Base):
    """MCP Server configuration table."""

    __tablename__ = "ca_mcp_servers"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Server identification
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    
    # Server configuration (JSONB payload accommodating different types like stdio, sse)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Versioning and auditing
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<McpServerConfig(id={self.id}, name='{self.name}')>"
