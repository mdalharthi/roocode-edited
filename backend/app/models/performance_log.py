"""
Performance Log model - performance metrics and monitoring.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PerformanceLog(Base):
    """Performance log table for tracking performance metrics."""

    __tablename__ = "ca_performance_logs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key
    action_log_id: Mapped[Optional[int]] = mapped_column(
        "action_log_id", Integer, ForeignKey("ca_action_logs.id"), nullable=True
    )

    # Session and identifiers
    session_id: Mapped[str] = mapped_column("session_id", String(255), nullable=False, index=True)
    operation_name: Mapped[Optional[str]] = mapped_column("operation_name", String(255), nullable=True)

    # Operation details
    operation_type: Mapped[str] = mapped_column("operation_type", String(100), nullable=False, index=True)

    # Performance metrics
    duration_ms: Mapped[Optional[float]] = mapped_column("duration_ms", Float, nullable=True)
    memory_usage: Mapped[Optional[int]] = mapped_column("memory_usage", Integer, nullable=True)  # bytes
    cpu_usage: Mapped[Optional[float]] = mapped_column("cpu_usage", Float, nullable=True)  # percentage
    execution_time: Mapped[int] = mapped_column("execution_time", Integer, nullable=False)  # milliseconds
    throughput: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # operations per second
    memory_usage_mb: Mapped[Optional[float]] = mapped_column("memory_usage_mb", Float, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column("file_size_bytes", Integer, nullable=True)

    # Additional metrics (JSON)
    resource_metrics: Mapped[Optional[dict]] = mapped_column("resource_metrics", JSONB, nullable=True)
    additional_metrics: Mapped[Optional[dict]] = mapped_column("additional_metrics", JSONB, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())

    # Relationship
    action_log: Mapped[Optional["ActionLog"]] = relationship("ActionLog", back_populates="performance_logs")

    def __repr__(self) -> str:
        return f"<PerformanceLog(id={self.id}, operation='{self.operation_type}', execution_time={self.execution_time}ms)>"
