"""
User Interaction Log model - user interaction and behavior tracking.
Linked to ActionLog via action_log_id foreign key.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserInteractionLog(Base):
    """User interaction log table for tracking user behavior."""

    __tablename__ = "ca_user_interaction_logs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to action logs
    action_log_id: Mapped[Optional[int]] = mapped_column(
        "action_log_id", 
        Integer, 
        ForeignKey("ca_action_logs.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Session and user identifiers (denormalized for direct queries)
    session_id: Mapped[str] = mapped_column("session_id", String(255), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column("user_id", String(255), nullable=True, index=True)

    # Interaction details
    interaction_type: Mapped[str] = mapped_column("interaction_type", String(100), nullable=False, index=True)
    component: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    result: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Context - interaction metadata stored as JSONB
    context: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())

    # Relationship to ActionLog
    action_log: Mapped[Optional["ActionLog"]] = relationship("ActionLog", back_populates="user_interaction_logs")

    def __repr__(self) -> str:
        return f"<UserInteractionLog(id={self.id}, type='{self.interaction_type}', component='{self.component}')>"
