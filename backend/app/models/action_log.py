"""
Action Log model - comprehensive logging for all application actions.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ActionLog(Base):
    """Action log table for tracking all application actions."""

    __tablename__ = "ca_action_logs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Session and identifiers
    session_id: Mapped[str] = mapped_column("session_id", String(255), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column("user_id", String(255), nullable=True, index=True)
    workspace_id: Mapped[Optional[str]] = mapped_column("workspace_id", String(255), nullable=True, index=True)

    # Action details
    action_type: Mapped[str] = mapped_column("action_type", String(100), nullable=False, index=True)
    action_name: Mapped[str] = mapped_column("action_name", String(255), nullable=False)

    # Status and response
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    response_code: Mapped[Optional[int]] = mapped_column("response_code", Integer, nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # milliseconds

    # Data
    input_data: Mapped[Optional[dict]] = mapped_column("input_data", JSONB, nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column("output_data", JSONB, nullable=True)

    # Error information
    error_message: Mapped[Optional[str]] = mapped_column("error_message", Text, nullable=True)
    error_stack: Mapped[Optional[str]] = mapped_column("error_stack", Text, nullable=True)

    # Metadata (renamed to avoid SQLAlchemy reserved name)
    action_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at", DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    api_logs: Mapped[list["ApiLog"]] = relationship("ApiLog", back_populates="action_log", cascade="all, delete-orphan")
    performance_logs: Mapped[list["PerformanceLog"]] = relationship(
        "PerformanceLog", back_populates="action_log", cascade="all, delete-orphan"
    )
    user_interaction_logs: Mapped[list["UserInteractionLog"]] = relationship(
        "UserInteractionLog", back_populates="action_log", cascade="all, delete-orphan"
    )
    file_operation_logs: Mapped[list["FileOperationLog"]] = relationship(
        "FileOperationLog", back_populates="action_log", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ActionLog(id={self.id}, type='{self.action_type}', name='{self.action_name}', status='{self.status}')>"
