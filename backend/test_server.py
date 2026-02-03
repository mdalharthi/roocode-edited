#!/usr/bin/env python
"""
Test script to verify backend setup and start the server.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all imports work correctly."""
    print("Testing imports...")
    try:
        from app.config import settings
        print(f"✓ Config loaded: {settings.APP_NAME} v{settings.APP_VERSION}")
        print(f"✓ Database URL: {settings.DATABASE_URL[:50]}...")
        print(f"✓ API Key configured: {'Yes' if settings.API_KEY else 'No'}")
        print(f"✓ Encryption Key configured: {'Yes' if settings.ENCRYPTION_KEY else 'No'}")

        from app.database import Base
        print("✓ Database module imported")

        from app.models import (
            ApiProvider, Run, Task, TaskMetrics, ToolError,
            ActionLog, ApiLog, PerformanceLog, UserInteractionLog,
            FileOperationLog, ExtensionVersion
        )
        print("✓ All 11 models imported successfully")

        from app.core import security, exceptions, middleware
        print("✓ Core utilities imported")

        from app.main import app
        print("✓ FastAPI app imported")

        print("\n✅ All imports successful!\n")
        return True
    except Exception as e:
        print(f"\n❌ Import failed: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def test_database_connection():
    """Test database connection."""
    print("Testing database connection...")
    try:
        import asyncio
        from app.database import check_db_health

        async def check():
            healthy = await check_db_health()
            if healthy:
                print("✅ Database connection successful!\n")
            else:
                print("⚠️  Database connection failed. Make sure PostgreSQL is running.\n")
            return healthy

        return asyncio.run(check())
    except Exception as e:
        print(f"❌ Database test failed: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def start_server():
    """Start the FastAPI server."""
    print("Starting FastAPI server...")
    print("=" * 60)
    print("Server will be available at:")
    print("  • API: http://localhost:8000")
    print("  • Docs: http://localhost:8000/docs")
    print("  • Health: http://localhost:8000/api/v1/health")
    print("=" * 60)
    print("\nPress Ctrl+C to stop the server\n")

    import uvicorn
    from app.config import settings

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Code Assistant Backend - Test & Start")
    print("=" * 60 + "\n")

    # Test imports
    if not test_imports():
        sys.exit(1)

    # Test database
    db_ok = test_database_connection()
    if not db_ok:
        print("⚠️  Warning: Database connection failed, but server will still start.")
        print("   The server will attempt to create tables on first request.\n")

    # Start server
    try:
        start_server()
    except KeyboardInterrupt:
        print("\n\n✋ Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server failed to start: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
