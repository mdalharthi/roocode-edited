"""
API Log model - specific logging for API requests and responses.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, Float, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ApiLog(Base):
    """API log table for tracking API requests and responses."""

    __tablename__ = "ca_api_logs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key
    action_log_id: Mapped[Optional[int]] = mapped_column(
        "action_log_id", Integer, ForeignKey("ca_action_logs.id"), nullable=True
    )

    # Session and identifiers
    session_id: Mapped[str] = mapped_column("session_id", String(255), nullable=False, index=True)

    # Request details
    method: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Headers and body
    request_headers: Mapped[Optional[dict]] = mapped_column("request_headers", JSONB, nullable=True)
    request_body: Mapped[Optional[dict]] = mapped_column("request_body", JSONB, nullable=True)
    response_headers: Mapped[Optional[dict]] = mapped_column("response_headers", JSONB, nullable=True)
    response_body: Mapped[Optional[dict]] = mapped_column("response_body", JSONB, nullable=True)

    # Response status
    status_code: Mapped[Optional[int]] = mapped_column("status_code", Integer, nullable=True, index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column("duration_ms", Integer, nullable=True)

    # Usage metrics
    tokens_used: Mapped[Optional[int]] = mapped_column("tokens_used", Integer, nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    retry_count: Mapped[int] = mapped_column("retry_count", Integer, nullable=False, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())

    # Relationship
    action_log: Mapped[Optional["ActionLog"]] = relationship("ActionLog", back_populates="api_logs")

    def __repr__(self) -> str:
        return f"<ApiLog(id={self.id}, method='{self.method}', provider='{self.provider}', status={self.status_code})>"
