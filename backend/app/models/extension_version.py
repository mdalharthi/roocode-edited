"""
Extension Version model - track extension version and migration status.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExtensionVersion(Base):
    """Extension version table for version control and database locking."""

    __tablename__ = "ca_extension_versions"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Version information
    extension_version: Mapped[str] = mapped_column("extension_version", String(50), nullable=False, index=True)
    schema_version: Mapped[int] = mapped_column("schema_version", Integer, nullable=False, default=1)
    migration_hash: Mapped[Optional[str]] = mapped_column("migration_hash", String(255), nullable=True)

    # Locking mechanism
    is_locked: Mapped[bool] = mapped_column("is_locked", Boolean, nullable=False, default=False, index=True)
    locked_at: Mapped[Optional[datetime]] = mapped_column("locked_at", DateTime, nullable=True)
    locked_reason: Mapped[Optional[str]] = mapped_column("locked_reason", Text, nullable=True)

    # Sync tracking
    last_synced_at: Mapped[datetime] = mapped_column(
        "last_synced_at", DateTime, nullable=False, server_default=func.now()
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at", DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<ExtensionVersion(id={self.id}, version='{self.extension_version}', locked={self.is_locked})>"
