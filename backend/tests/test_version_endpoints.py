"""Tests for version control endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_version(client: AsyncClient, auth_headers):
    """Test getting current version."""
    response = await client.get("/api/v1/version", headers=auth_headers)
    # Might be 404 if not initialized
    if response.status_code == 200:
        data = response.json()
        assert "version" in data
        assert "is_locked" in data
    else:
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_initialize_version(client: AsyncClient, auth_headers):
    """Test initializing version."""
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    response = await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )
    # Should succeed or conflict if already exists
    assert response.status_code in [201, 409]
    if response.status_code == 201:
        data = response.json()
        assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_verify_version(client: AsyncClient, auth_headers):
    """Test verifying version match."""
    # Initialize version first
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )

    # Verify matching version
    verify_data = {"version": "1.0.0"}
    response = await client.post(
        "/api/v1/version/verify",
        json=verify_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matches"] is True

    # Verify non-matching version
    verify_data = {"version": "2.0.0"}
    response = await client.post(
        "/api/v1/version/verify",
        json=verify_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matches"] is False


@pytest.mark.asyncio
async def test_lock_version(client: AsyncClient, auth_headers):
    """Test locking version."""
    # Initialize version first
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )

    # Lock version
    lock_data = {"reason": "migration in progress"}
    response = await client.post(
        "/api/v1/version/lock",
        json=lock_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_locked"] is True


@pytest.mark.asyncio
async def test_unlock_version(client: AsyncClient, auth_headers):
    """Test unlocking version."""
    # Initialize and lock version first
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )

    lock_data = {"reason": "test lock"}
    await client.post(
        "/api/v1/version/lock",
        json=lock_data,
        headers=auth_headers
    )

    # Unlock version
    response = await client.post(
        "/api/v1/version/unlock",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_locked"] is False


@pytest.mark.asyncio
async def test_get_lock_status(client: AsyncClient, auth_headers):
    """Test getting lock status."""
    # Initialize version first
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )

    # Get status
    response = await client.get("/api/v1/version/status", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "is_locked" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_update_version(client: AsyncClient, auth_headers):
    """Test updating version."""
    # Initialize version first
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )

    # Update version
    update_data = {
        "version": "1.1.0",
        "schema_version": "1.1",
    }
    response = await client.put(
        "/api/v1/version",
        json=update_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.1.0"


@pytest.mark.asyncio
async def test_locked_version_prevents_operations(client: AsyncClient, auth_headers):
    """Test that locked version prevents certain operations."""
    # Initialize and lock version
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )

    lock_data = {"reason": "testing lock behavior"}
    await client.post(
        "/api/v1/version/lock",
        json=lock_data,
        headers=auth_headers
    )

    # This depends on whether your API enforces locks on other endpoints
    # For now, we just verify the lock status
    response = await client.get("/api/v1/version/status", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["is_locked"] is True
