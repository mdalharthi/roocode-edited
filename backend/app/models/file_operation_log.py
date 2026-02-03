"""
File Operation Log model - detailed file operation metrics and tracking.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FileOperationLog(Base):
    """File operation log table for tracking file changes."""

    __tablename__ = "ca_file_operation_logs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key
    action_log_id: Mapped[Optional[int]] = mapped_column(
        "action_log_id", Integer, ForeignKey("ca_action_logs.id"), nullable=True
    )

    # Session
    session_id: Mapped[str] = mapped_column("session_id", String(255), nullable=False, index=True)

    # File details
    file_path: Mapped[str] = mapped_column("file_path", Text, nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # write, read, delete, rename
    mode: Mapped[str] = mapped_column(String(50), nullable=False)  # edit or create

    # Version tracking
    version_before: Mapped[Optional[str]] = mapped_column("version_before", String(255), nullable=True)
    version_after: Mapped[Optional[str]] = mapped_column("version_after", String(255), nullable=True)

    # Line metrics
    previous_total_lines: Mapped[Optional[int]] = mapped_column("previous_total_lines", Integer, nullable=True)
    new_total_lines: Mapped[Optional[int]] = mapped_column("new_total_lines", Integer, nullable=True)
    new_lines_added: Mapped[Optional[int]] = mapped_column("new_lines_added", Integer, nullable=True)
    lines_removed: Mapped[Optional[int]] = mapped_column("lines_removed", Integer, nullable=True)
    lines_modified: Mapped[Optional[int]] = mapped_column("lines_modified", Integer, nullable=True)
    non_empty_lines_before: Mapped[Optional[int]] = mapped_column("non_empty_lines_before", Integer, nullable=True)
    non_empty_lines_after: Mapped[Optional[int]] = mapped_column("non_empty_lines_after", Integer, nullable=True)

    # File metadata
    content_type: Mapped[Optional[str]] = mapped_column("content_type", String(100), nullable=True)
    file_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column("file_size_bytes", Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column("duration_ms", Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())

    # Relationship
    action_log: Mapped[Optional["ActionLog"]] = relationship("ActionLog", back_populates="file_operation_logs")

    def __repr__(self) -> str:
        return f"<FileOperationLog(id={self.id}, path='{self.file_path}', operation='{self.operation}', mode='{self.mode}')>"
