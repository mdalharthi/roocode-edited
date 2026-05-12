"""
Database connection and session management.
Uses SQLAlchemy 2.0 with async support via asyncpg.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.config import settings

# Create async engine with connection pooling
engine = create_async_engine(
    settings.database_url_async,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,  # Recycle connections after 1 hour
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for all models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database sessions.

    Yields:
        AsyncSession: Database session

    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database: create all tables if they don't exist.
    This is idempotent - safe to run multiple times.
    Fails gracefully if database is not accessible.
    """
    import logging

    # Import all models here to ensure they're registered
    try:
        from app.models import (  # noqa: F401
            api_provider,
            action_log,
            api_log,
            performance_log,
            user_interaction_log,
            file_operation_log,
            extension_version,
            mcp_log,
            mcp_server,
        )
        logging.info("Models imported successfully")
    except Exception as e:
        logging.warning(f"Model import failed: {e}. Server will start without database.")
        return

    # Create tables in a separate task with timeout
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logging.info("✅ Database initialized successfully - all tables created")
    except Exception as e:
        # Log error but don't crash the server
        logging.warning(f"Database table creation failed: {e}. Server will start with graceful degradation.")


async def close_db() -> None:
    """Close database connections. Call on application shutdown."""
    await engine.dispose()


async def check_db_health() -> bool:
    """
    Check database connection health.

    Returns:
        bool: True if database is healthy, False otherwise
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.error(f"Database health check failed: {type(e).__name__}: {e}")
        return False


async def get_db_pool_stats() -> dict:
    """
    Get database connection pool statistics.

    Returns:
        dict: Pool statistics
    """
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in_connections": pool.checkedin(),
        "checked_out_connections": pool.checkedout(),
        "overflow_connections": pool.overflow(),
        "total_connections": pool.size() + pool.overflow(),
    }
