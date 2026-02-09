"""
User verification endpoints - LDAP user verification against Active Directory.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import verify_api_key
from app.core.ldap_service import verify_ldap_user, LDAPService


router = APIRouter()


class UserVerifyRequest(BaseModel):
    """Request model for user verification."""
    username: str


class UserVerifyResponse(BaseModel):
    """Response model for user verification."""
    username: str
    verified: bool
    display_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None


class LDAPStatusResponse(BaseModel):
    """Response model for LDAP status check."""
    configured: bool
    connected: bool
    host: str
    port: int


@router.post("/users/verify", response_model=UserVerifyResponse)
async def verify_user(
    request: UserVerifyRequest,
    _api_key: str = Depends(verify_api_key),
) -> UserVerifyResponse:
    """
    Verify a username against Active Directory.
    
    If the user is found in AD, returns their information with verified=True.
    If the user is not found or LDAP is unavailable, returns username='unknown' with verified=False.
    """
    result = verify_ldap_user(request.username)
    print(result)
    return UserVerifyResponse(
        username=result.username,
        verified=result.verified,
        display_name=result.display_name,
        email=result.email,
        department=result.department,
    )


@router.get("/users/ldap-status", response_model=LDAPStatusResponse)
async def get_ldap_status(
    _api_key: str = Depends(verify_api_key),
) -> LDAPStatusResponse:
    """
    Check the status of LDAP configuration and connectivity.
    """
    from app.config import settings
    
    service = LDAPService.get_instance()
    
    return LDAPStatusResponse(
        configured=service.is_configured(),
        connected=service.test_connection(),
        host=settings.LDAP_HOST,
        port=settings.LDAP_PORT,
    )


class UserAuthRequest(BaseModel):
    """Request model for user authentication."""
    username: str
    password: str


class UserAuthResponse(BaseModel):
    """Response model for user authentication."""
    authenticated: bool
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    error: Optional[str] = None


@router.post("/users/authenticate", response_model=UserAuthResponse)
async def authenticate_user(
    request: UserAuthRequest,
    _api_key: str = Depends(verify_api_key),
) -> UserAuthResponse:
    """
    Authenticate a user against Active Directory using their credentials.
    
    Attempts to bind to LDAP with the provided username and password.
    Returns authenticated=True with user info on success, or authenticated=False with error on failure.
    """
    service = LDAPService.get_instance()
    
    if not service.is_configured():
        return UserAuthResponse(
            authenticated=False,
            username=request.username,
            error="LDAP is not configured",
        )
    
    result = service.authenticate_user(request.username, request.password)
    
    if result is None:
        return UserAuthResponse(
            authenticated=False,
            username=request.username,
            error="Invalid username or password",
        )
    
    return UserAuthResponse(
        authenticated=True,
        username=result.username,
        display_name=result.display_name,
        email=result.email,
        department=result.department,
    )

