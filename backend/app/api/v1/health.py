"""
Health check endpoints.
"""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import check_db_health, get_db_pool_stats
from app.api.deps import get_db_session
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.

    Returns:
        dict: Health status
    """
    db_healthy = await check_db_health()

    return {
        "status": "healthy" if db_healthy else "unhealthy",
        "database": "connected" if db_healthy else "disconnected",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """
    Detailed health check with database pool statistics.

    Returns:
        dict: Detailed health status
    """
    db_healthy = await check_db_health()
    pool_stats = await get_db_pool_stats()

    return {
        "status": "healthy" if db_healthy else "unhealthy",
        "database": {
            "connected": db_healthy,
            "pool_size": pool_stats.get("pool_size", 0),
            "checked_in_connections": pool_stats.get("checked_in_connections", 0),
            "checked_out_connections": pool_stats.get("checked_out_connections", 0),
            "overflow_connections": pool_stats.get("overflow_connections", 0),
            "total_connections": pool_stats.get("total_connections", 0),
        },
        "version": settings.APP_VERSION,
        "app_name": settings.APP_NAME,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
