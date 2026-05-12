"""
FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db, AsyncSessionLocal
from app.core.logging import setup_logging
from app.core.middleware import LoggingMiddleware, ExceptionMiddleware
from app.api.v1 import health, providers, logs, version, batch, users, mcp_servers
from app.seeds.mcp_servers import seed_default_mcp_servers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    Handles startup and shutdown events.
    """
    # Startup
    setup_logging()

    # Log database configuration for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info("=" * 80)
    logger.info("🔧 Backend Configuration:")
    logger.info(f"  DATABASE_URL (raw):       {settings.DATABASE_URL}")
    logger.info(f"  database_url_async (used): {settings.database_url_async}")
    logger.info(f"  Backend API URL:          http://{settings.HOST}:{settings.PORT}")
    logger.info(f"  CORS Origins:             {settings.ALLOWED_ORIGINS}")
    logger.info("=" * 80)

    await init_db()

    # Run seeds – inserts default rows if they don't exist yet
    async with AsyncSessionLocal() as session:
        await seed_default_mcp_servers(session)

    yield
    # Shutdown
    await close_db()


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Code Assistant - handles all database operations",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(LoggingMiddleware)
app.add_middleware(ExceptionMiddleware)

# Include routers
API_V1_PREFIX = "/api/v1"

app.include_router(health.router, prefix=API_V1_PREFIX, tags=["Health"])
app.include_router(providers.router, prefix=API_V1_PREFIX, tags=["API Providers"])
app.include_router(logs.router, prefix=API_V1_PREFIX, tags=["Logs"])
app.include_router(version.router, prefix=API_V1_PREFIX, tags=["Version Control"])
app.include_router(batch.router, prefix=API_V1_PREFIX, tags=["Batch Operations"])
app.include_router(users.router, prefix=API_V1_PREFIX, tags=["Users"])
app.include_router(mcp_servers.router, prefix=API_V1_PREFIX, tags=["MCP Servers"])



@app.get("/")
async def root():
    """Root endpoint - API information."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": f"{API_V1_PREFIX}/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
