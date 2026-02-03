"""
Custom exceptions for the application.
"""

from typing import Any, Dict, Optional, List


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []
        super().__init__(self.message)


class NotFoundException(AppException):
    """Exception raised when a resource is not found."""

    def __init__(self, message: str = "Resource not found", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details=details,
        )


class ValidationException(AppException):
    """Exception raised when validation fails."""

    def __init__(self, message: str = "Validation error", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details=details,
        )


class DatabaseException(AppException):
    """Exception raised when database operation fails."""

    def __init__(self, message: str = "Database error", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code="DATABASE_ERROR",
            status_code=500,
            details=details,
        )


class AuthenticationException(AppException):
    """Exception raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=401,
            details=details,
        )


class ConflictException(AppException):
    """Exception raised when there's a conflict (e.g., unique constraint violation)."""

    def __init__(self, message: str = "Resource conflict", details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409,
            details=details,
        )
