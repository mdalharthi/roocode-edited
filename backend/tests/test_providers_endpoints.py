"""Tests for API providers endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_providers(client: AsyncClient, auth_headers):
    """Test listing providers."""
    response = await client.get("/api/v1/providers", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data


@pytest.mark.asyncio
async def test_create_provider(client: AsyncClient, auth_headers):
    """Test creating a provider."""
    provider_data = {
        "name": "test-provider",
        "display_name": "Test Provider",
        "provider_type": "openai",
        "base_url": "https://api.openai.com",
        "auth_type": "bearer",
    }
    response = await client.post(
        "/api/v1/providers",
        json=provider_data,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test-provider"
    assert "id" in data


@pytest.mark.asyncio
async def test_get_provider_by_id(client: AsyncClient, auth_headers):
    """Test getting provider by ID."""
    # First create a provider
    provider_data = {
        "name": "test-get-provider",
        "display_name": "Test Get Provider",
        "provider_type": "anthropic",
        "base_url": "https://api.anthropic.com",
        "auth_type": "bearer",
    }
    create_response = await client.post(
        "/api/v1/providers",
        json=provider_data,
        headers=auth_headers
    )
    provider_id = create_response.json()["id"]

    # Get the provider
    response = await client.get(
        f"/api/v1/providers/{provider_id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == provider_id


@pytest.mark.asyncio
async def test_update_provider(client: AsyncClient, auth_headers):
    """Test updating a provider."""
    # Create provider first
    provider_data = {
        "name": "test-update-provider",
        "display_name": "Test Update Provider",
        "provider_type": "openai",
        "base_url": "https://api.openai.com",
        "auth_type": "bearer",
    }
    create_response = await client.post(
        "/api/v1/providers",
        json=provider_data,
        headers=auth_headers
    )
    provider_id = create_response.json()["id"]

    # Update provider
    update_data = {"display_name": "Updated Provider Name"}
    response = await client.patch(
        f"/api/v1/providers/{provider_id}",
        json=update_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Updated Provider Name"


@pytest.mark.asyncio
async def test_delete_provider(client: AsyncClient, auth_headers):
    """Test deleting a provider."""
    # Create provider first
    provider_data = {
        "name": "test-delete-provider",
        "display_name": "Test Delete Provider",
        "provider_type": "openai",
        "base_url": "https://api.openai.com",
        "auth_type": "bearer",
    }
    create_response = await client.post(
        "/api/v1/providers",
        json=provider_data,
        headers=auth_headers
    )
    provider_id = create_response.json()["id"]

    # Delete provider
    response = await client.delete(
        f"/api/v1/providers/{provider_id}",
        headers=auth_headers
    )
    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(
        f"/api/v1/providers/{provider_id}",
        headers=auth_headers
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_get_provider_by_name(client: AsyncClient, auth_headers):
    """Test getting provider by name."""
    # Create provider first
    provider_data = {
        "name": "test-name-provider",
        "display_name": "Test Name Provider",
        "provider_type": "openai",
        "base_url": "https://api.openai.com",
        "auth_type": "bearer",
    }
    await client.post(
        "/api/v1/providers",
        json=provider_data,
        headers=auth_headers
    )

    # Get by name
    response = await client.get(
        "/api/v1/providers/by-name/test-name-provider",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-name-provider"
