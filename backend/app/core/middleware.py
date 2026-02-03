"""
Middleware for request/response processing.
"""

import time
import logging
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.exceptions import AppException, ConflictException, DatabaseException

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Log incoming requests and outgoing responses.

        Args:
            request: Incoming request
            call_next: Next middleware or route handler

        Returns:
            Response: Response from route handler
        """
        start_time = time.time()

        # Log request
        logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else None,
            },
        )

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log response
        logger.info(
            f"Outgoing response: {response.status_code} - {duration:.3f}s",
            extra={
                "status_code": response.status_code,
                "duration": duration,
                "method": request.method,
                "path": request.url.path,
            },
        )

        # Add custom headers
        response.headers["X-Process-Time"] = str(duration)

        return response


class ExceptionMiddleware(BaseHTTPMiddleware):
    """Middleware for handling exceptions and returning consistent error responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Handle exceptions and return consistent error responses.

        Args:
            request: Incoming request
            call_next: Next middleware or route handler

        Returns:
            Response: Response from route handler or error response
        """
        try:
            return await call_next(request)
        except AppException as e:
            # Application exceptions
            logger.warning(f"Application exception: {e.message}", exc_info=True)
            return JSONResponse(
                status_code=e.status_code,
                content={"error": {"code": e.code, "message": e.message, "details": e.details}},
            )
        except IntegrityError as e:
            # Database integrity errors (unique constraints, foreign keys, etc.)
            logger.error(f"Database integrity error: {e}", exc_info=True)

            # Check if it's a unique constraint violation
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
                return JSONResponse(
                    status_code=409,
                    content={
                        "error": {
                            "code": "CONFLICT",
                            "message": "Resource already exists or violates unique constraint",
                            "details": [{"field": "unknown", "message": error_msg}],
                        }
                    },
                )

            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "DATABASE_INTEGRITY_ERROR",
                        "message": "Database integrity constraint violated",
                        "details": [{"message": error_msg}],
                    }
                },
            )
        except SQLAlchemyError as e:
            # Other database errors
            logger.error(f"Database error: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "DATABASE_ERROR",
                        "message": "Database operation failed",
                        "details": [{"message": str(e)}],
                    }
                },
            )
        except Exception as e:
            # Unexpected errors
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred",
                        "details": [{"message": str(e)}] if logger.level == logging.DEBUG else [],
                    }
                },
            )
