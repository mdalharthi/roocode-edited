"""
API dependencies - authentication, database sessions, pagination.
"""

from typing import AsyncGenerator, Optional
from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import verify_api_key
from app.config import settings


# Database session dependency
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session.

    Yields:
        AsyncSession: Database session
    """
    async for session in get_db():
        yield session


# Authentication dependency
def get_current_api_key(api_key: str = Depends(verify_api_key)) -> str:
    """
    Get and verify current API key.

    Args:
        api_key: Verified API key from header

    Returns:
        str: Validated API key
    """
    return api_key


# Pagination dependencies
class PaginationParams:
    """Pagination parameters for list endpoints."""

    def __init__(
        self,
        limit: int = Query(default=settings.DEFAULT_PAGE_SIZE, ge=1, le=settings.MAX_PAGE_SIZE),
        offset: int = Query(default=0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


def get_pagination(params: PaginationParams = Depends()) -> PaginationParams:
    """
    Get pagination parameters.

    Args:
        params: Pagination parameters from query

    Returns:
        PaginationParams: Pagination parameters
    """
    return params
