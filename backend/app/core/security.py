"""
Security utilities for authentication and encryption.
"""

from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

# API Key header for authentication
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """
    Verify API key from request header.

    Args:
        api_key: API key from X-API-Key header

    Returns:
        str: Validated API key

    Raises:
        HTTPException: If API key is missing or invalid
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Please provide X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return api_key


# Fernet encryption instance
_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Get or create Fernet encryption instance."""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    return _fernet


def encrypt_api_key(api_key: str) -> str:
    """
    Encrypt an API key using Fernet symmetric encryption.

    Args:
        api_key: Plain text API key

    Returns:
        str: Encrypted API key (base64 encoded)
    """
    if not api_key:
        return ""

    fernet = _get_fernet()
    encrypted = fernet.encrypt(api_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Decrypt an API key using Fernet symmetric encryption.

    Args:
        encrypted_key: Encrypted API key (base64 encoded)

    Returns:
        str: Decrypted plain text API key

    Raises:
        ValueError: If decryption fails
    """
    if not encrypted_key:
        return ""

    try:
        fernet = _get_fernet()
        decrypted = fernet.decrypt(encrypted_key.encode())
        return decrypted.decode()
    except InvalidToken as e:
        raise ValueError(f"Failed to decrypt API key: {e}")


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.

    Returns:
        str: Base64 encoded encryption key

    Usage:
        Used for generating ENCRYPTION_KEY environment variable.
        Run: python -c "from app.core.security import generate_encryption_key; print(generate_encryption_key())"
    """
    return Fernet.generate_key().decode()


def generate_api_key(length: int = 32) -> str:
    """
    Generate a secure random API key.

    Args:
        length: Length of the API key (default: 32)

    Returns:
        str: URL-safe random API key

    Usage:
        Used for generating API_KEY environment variable.
        Run: python -c "from app.core.security import generate_api_key; print(generate_api_key())"
    """
    import secrets

    return secrets.token_urlsafe(length)
