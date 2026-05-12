"""
API Provider endpoints - CRUD operations for API provider configurations.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.api_provider import ApiProvider
from app.schemas.api_provider import (
    ApiProviderCreate,
    ApiProviderUpdate,
    ApiProviderResponse,
    ApiProviderListResponse,
)
from app.core.security import verify_api_key
from app.core.exceptions import NotFoundException, ConflictException
from app.api.deps import PaginationParams, get_pagination

router = APIRouter()


@router.get("/providers", response_model=ApiProviderListResponse)
async def list_providers(
    provider_type: Optional[str] = Query(None, description="Filter by provider type"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List all API providers with optional filtering and pagination."""
    query = select(ApiProvider).order_by(ApiProvider.name)

    if provider_type:
        query = query.where(ApiProvider.provider_type == provider_type)

    # Get total count
    count_query = select(ApiProvider)
    if provider_type:
        count_query = count_query.where(ApiProvider.provider_type == provider_type)
    result = await db.execute(count_query)
    total = len(result.all())

    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    providers = result.scalars().all()

    return ApiProviderListResponse(
        providers=[ApiProviderResponse.model_validate(p) for p in providers],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/providers/{provider_id}", response_model=ApiProviderResponse)
async def get_provider_by_id(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Get API provider by ID."""
    result = await db.execute(select(ApiProvider).where(ApiProvider.id == provider_id))
    provider = result.scalar_one_or_none()

    if not provider:
        raise NotFoundException(f"Provider with id {provider_id} not found")

    return ApiProviderResponse.model_validate(provider)


@router.get("/providers/by-name/{name}", response_model=ApiProviderResponse)
async def get_provider_by_name(
    name: str,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Get API provider by name."""
    result = await db.execute(select(ApiProvider).where(ApiProvider.name == name))
    provider = result.scalar_one_or_none()

    if not provider:
        raise NotFoundException(f"Provider with name '{name}' not found")

    return ApiProviderResponse.model_validate(provider)


@router.post("/providers", response_model=ApiProviderResponse, status_code=201)
async def create_provider(
    provider_data: ApiProviderCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new API provider. Idempotent: returns existing provider if already exists."""
    # Check if provider already exists
    result = await db.execute(select(ApiProvider).where(ApiProvider.name == provider_data.name))
    existing_provider = result.scalar_one_or_none()
    
    if existing_provider:
        return ApiProviderResponse.model_validate(existing_provider)
    
    # Provider doesn't exist, create it
    provider = ApiProvider(
        name=provider_data.name,
        display_name=provider_data.display_name,
        provider_type=provider_data.provider_type,
        base_url=provider_data.base_url,
        api_key_encrypted=provider_data.api_key_encrypted,
        auth_type=provider_data.auth_type,
        rate_limit_requests_per_minute=provider_data.rate_limit_requests_per_minute,
        rate_limit_requests_per_hour=provider_data.rate_limit_requests_per_hour,
        rate_limit_requests_per_day=provider_data.rate_limit_requests_per_day,
        config_metadata=provider_data.config_metadata or {},
        created_by=provider_data.created_by,
        updated_by=provider_data.created_by,
    )

    try:
        db.add(provider)
        await db.commit()
        await db.refresh(provider)
    except IntegrityError as e:
        await db.rollback()
        if "unique" in str(e).lower():
            raise ConflictException(f"Provider with name '{provider_data.name}' already exists")
        raise

    return ApiProviderResponse.model_validate(provider)


@router.patch("/providers/{provider_id}", response_model=ApiProviderResponse)
async def update_provider(
    provider_id: int,
    provider_data: ApiProviderUpdate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Update an existing API provider (partial update)."""
    result = await db.execute(select(ApiProvider).where(ApiProvider.id == provider_id))
    provider = result.scalar_one_or_none()

    if not provider:
        raise NotFoundException(f"Provider with id {provider_id} not found")

    update_data = provider_data.model_dump(exclude_unset=True)
    update_data["version"] = provider.version + 1

    for key, value in update_data.items():
        setattr(provider, key, value)

    try:
        await db.commit()
        await db.refresh(provider)
    except IntegrityError as e:
        await db.rollback()
        raise ConflictException(f"Update conflict: {str(e)}")

    return ApiProviderResponse.model_validate(provider)


@router.delete("/providers/{provider_id}", status_code=204)
async def delete_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Delete an API provider."""
    result = await db.execute(select(ApiProvider).where(ApiProvider.id == provider_id))
    provider = result.scalar_one_or_none()

    if not provider:
        raise NotFoundException(f"Provider with id {provider_id} not found")

    await db.delete(provider)
    await db.commit()

    return None
@router.patch("/providers/by-name/{name}", response_model=ApiProviderResponse)
async def update_provider_by_name(
    name: str,
    provider_data: ApiProviderUpdate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Update an existing API provider by name (partial update)."""
    result = await db.execute(select(ApiProvider).where(ApiProvider.name == name))
    provider = result.scalar_one_or_none()

    if not provider:
        raise NotFoundException(f"Provider with name '{name}' not found")

    update_data = provider_data.model_dump(exclude_unset=True)
    update_data["version"] = provider.version + 1

    for key, value in update_data.items():
        setattr(provider, key, value)

    try:
        await db.commit()
        await db.refresh(provider)
    except IntegrityError as e:
        await db.rollback()
        raise ConflictException(f"Update conflict: {str(e)}")

    return ApiProviderResponse.model_validate(provider)


@router.delete("/providers/by-name/{name}", status_code=204)
async def delete_provider_by_name(
    name: str,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Delete an API provider by name."""
    result = await db.execute(select(ApiProvider).where(ApiProvider.name == name))
    provider = result.scalar_one_or_none()

    if not provider:
        raise NotFoundException(f"Provider with name '{name}' not found")

    await db.delete(provider)
    await db.commit()

    return None
