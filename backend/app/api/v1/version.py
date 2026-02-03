"""
Version Control endpoints - manage extension version and database locking.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.database import get_db
from app.models.extension_version import ExtensionVersion
from app.schemas.extension_version import (
    ExtensionVersionCreate,
    ExtensionVersionUpdate,
    ExtensionVersionResponse,
    VersionLockRequest,
    VersionUnlockRequest,
    VersionVerifyRequest,
    VersionVerifyResponse,
    VersionStatusResponse,
)
from app.core.security import verify_api_key
from app.core.exceptions import NotFoundException, ConflictException

router = APIRouter()


async def _get_current_version(db: AsyncSession) -> Optional[ExtensionVersion]:
    """Helper to get the most recent version record."""
    result = await db.execute(
        select(ExtensionVersion).order_by(desc(ExtensionVersion.id)).limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/version", response_model=ExtensionVersionResponse)
async def get_current_version(
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Get the current extension version record."""
    version = await _get_current_version(db)

    if not version:
        raise NotFoundException("No version record found. Please initialize version first.")

    return ExtensionVersionResponse.model_validate(version)


@router.post("/version/initialize", response_model=ExtensionVersionResponse, status_code=201)
async def initialize_version(
    version_data: ExtensionVersionCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Initialize a new version record. Creates the first version entry."""
    existing = await _get_current_version(db)

    if existing:
        raise ConflictException(
            f"Version already initialized. Current version: {existing.extension_version}"
        )

    version = ExtensionVersion(
        extension_version=version_data.extension_version,
        schema_version=version_data.schema_version,
        migration_hash=version_data.migration_hash,
        is_locked=False,
        last_synced_at=func.now(),
    )

    db.add(version)
    await db.commit()
    await db.refresh(version)

    return ExtensionVersionResponse.model_validate(version)


@router.patch("/version", response_model=ExtensionVersionResponse)
async def update_version(
    version_data: ExtensionVersionUpdate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Update the current version record."""
    version = await _get_current_version(db)

    if not version:
        raise NotFoundException("No version record found. Please initialize version first.")

    update_data = version_data.model_dump(exclude_unset=True)

    # Force server-side timestamp for synchronization consistency if provided
    if "last_synced_at" in update_data:
        update_data["last_synced_at"] = func.now()

    for key, value in update_data.items():
        setattr(version, key, value)

    await db.commit()
    await db.refresh(version)

    return ExtensionVersionResponse.model_validate(version)


@router.post("/version/verify", response_model=VersionVerifyResponse)
async def verify_version(
    verify_request: VersionVerifyRequest,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """
    Verify if the provided version matches the current database version.
    
    - If version matches: Updates last_synced_at and returns success
    - If version mismatches: Locks the database and returns lock status
    - If already locked: Returns current lock status
    """
    version = await _get_current_version(db)

    if not version:
        return VersionVerifyResponse(
            matches=False,
            is_locked=False,
            current_version="unknown",
            current_schema_version=0,
            requested_version=verify_request.extension_version,
            requested_schema_version=verify_request.schema_version,
            message="No version record found in database",
        )

    version_matches = version.extension_version == verify_request.extension_version
    schema_matches = True

    if verify_request.schema_version is not None:
        schema_matches = version.schema_version == verify_request.schema_version

    matches = version_matches and schema_matches

    # Handle version match - update last_synced_at
    if matches:
        version.last_synced_at = func.now()
        await db.commit()
        await db.refresh(version)
        
        message = "Version verified and synced successfully"
    
    # Handle version mismatch - auto-lock
    elif not version.is_locked:
        # Lock the database due to version mismatch
        version.is_locked = True
        version.locked_at = func.now()
        
        if not version_matches:
            version.locked_reason = (
                f"Version mismatch: expected {version.extension_version}, "
                f"got {verify_request.extension_version}"
            )
        else:
            version.locked_reason = (
                f"Schema version mismatch: expected {version.schema_version}, "
                f"got {verify_request.schema_version}"
            )
        
        await db.commit()
        await db.refresh(version)
        
        message = f"Extension locked: {version.locked_reason}"
    
    # Already locked
    else:
        message = f"Extension is locked: {version.locked_reason or 'Unknown reason'}"

    return VersionVerifyResponse(
        matches=matches,
        is_locked=version.is_locked,
        locked_at=version.locked_at,
        locked_reason=version.locked_reason,
        current_version=version.extension_version,
        current_schema_version=version.schema_version,
        requested_version=verify_request.extension_version,
        requested_schema_version=verify_request.schema_version,
        message=message,
    )


@router.post("/version/lock", response_model=ExtensionVersionResponse)
async def lock_database(
    lock_request: VersionLockRequest,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Lock the database to prevent concurrent modifications."""
    version = await _get_current_version(db)

    if not version:
        raise NotFoundException("No version record found. Please initialize version first.")

    if version.is_locked:
        raise ConflictException(
            f"Database is already locked. Locked at: {version.locked_at}, "
            f"Reason: {version.locked_reason or 'No reason provided'}"
        )

    version.is_locked = True
    version.locked_at = func.now()
    version.locked_reason = lock_request.reason

    await db.commit()
    await db.refresh(version)

    return ExtensionVersionResponse.model_validate(version)


@router.post("/version/unlock", response_model=ExtensionVersionResponse)
async def unlock_database(
    unlock_request: VersionUnlockRequest,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Unlock the database to allow modifications."""
    version = await _get_current_version(db)

    if not version:
        raise NotFoundException("No version record found. Please initialize version first.")

    if not version.is_locked and not unlock_request.force:
        raise ConflictException("Database is not locked")

    version.is_locked = False
    version.locked_at = None
    version.locked_reason = None

    await db.commit()
    await db.refresh(version)

    return ExtensionVersionResponse.model_validate(version)


@router.get("/version/status", response_model=VersionStatusResponse)
async def get_lock_status(
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Get the current database lock status."""
    version = await _get_current_version(db)

    if not version:
        raise NotFoundException("No version record found. Please initialize version first.")

    return VersionStatusResponse(
        is_locked=version.is_locked,
        locked_at=version.locked_at,
        locked_reason=version.locked_reason,
        extension_version=version.extension_version,
        schema_version=version.schema_version,
    )
