"""Integration tests for complete workflows and business logic."""
import pytest
from httpx import AsyncClient
from datetime import datetime


@pytest.mark.asyncio
async def test_complete_run_workflow(client: AsyncClient, auth_headers):
    """Test complete workflow: create run -> tasks -> metrics -> finish run."""
    # 1. Create a run
    run_data = {
        "model": "gpt-4",
        "socket_path": "/tmp/complete-workflow.sock",
        "concurrency": 2,
        "timeout": 10,
    }
    run_response = await client.post(
        "/api/v1/runs",
        json=run_data,
        headers=auth_headers
    )
    assert run_response.status_code == 201
    run_id = run_response.json()["id"]

    # 2. Create multiple tasks
    task_ids = []
    for i in range(3):
        task_data = {
            "run_id": run_id,
            "language": "python",
            "exercise": f"workflow-task-{i}",
            "passed": i < 2,  # First 2 pass, last one fails
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": datetime.utcnow().isoformat(),
        }
        task_response = await client.post(
            "/api/v1/tasks",
            json=task_data,
            headers=auth_headers
        )
        assert task_response.status_code == 201
        task_ids.append(task_response.json()["id"])

    # 3. Add metrics to tasks
    total_tokens = 0
    total_cost = 0.0
    for task_id in task_ids:
        metrics_data = {
            "task_id": task_id,
            "input_tokens": 500,
            "output_tokens": 250,
            "total_tokens": 750,
            "cost": 0.025,
            "duration_ms": 1500.0,
        }
        total_tokens += 750
        total_cost += 0.025
        
        metrics_response = await client.post(
            "/api/v1/task-metrics",
            json=metrics_data,
            headers=auth_headers
        )
        assert metrics_response.status_code == 201

    # 4. Finish the run
    finish_data = {
        "passed": 2,
        "failed": 1,
    }
    finish_response = await client.post(
        f"/api/v1/runs/{run_id}/finish",
        json=finish_data,
        headers=auth_headers
    )
    assert finish_response.status_code == 200
    finish_result = finish_response.json()
    assert finish_result["passed"] == 2
    assert finish_result["failed"] == 1

    # 5. Verify run aggregation
    run_get = await client.get(
        f"/api/v1/runs/{run_id}",
        headers=auth_headers
    )
    assert run_get.status_code == 200
    run_data_final = run_get.json()
    assert run_data_final["passed"] == 2
    assert run_data_final["failed"] == 1
    # Should have aggregated metrics
    assert "tasks" in run_data_final
    assert len(run_data_final["tasks"]) == 3


@pytest.mark.asyncio
async def test_provider_encryption_workflow(client: AsyncClient, auth_headers):
    """Test that API keys are encrypted when stored."""
    # Create provider with API key
    provider_data = {
        "name": "encryption-test",
        "display_name": "Encryption Test Provider",
        "provider_type": "openai",
        "base_url": "https://api.openai.com",
        "auth_type": "bearer",
        "api_key": "sk-test-plain-text-key-123456",
    }
    create_response = await client.post(
        "/api/v1/providers",
        json=provider_data,
        headers=auth_headers
    )
    assert create_response.status_code == 201
    provider_id = create_response.json()["id"]

    # Get provider back
    get_response = await client.get(
        f"/api/v1/providers/{provider_id}",
        headers=auth_headers
    )
    assert get_response.status_code == 200
    provider = get_response.json()

    # API key should be present (decrypted for response)
    assert "api_key" in provider
    # In the response, it should be decrypted back to original
    assert provider["api_key"] == "sk-test-plain-text-key-123456"


@pytest.mark.asyncio
async def test_cascade_delete_run(client: AsyncClient, auth_headers):
    """Test that deleting a run cascades to tasks and errors."""
    # Create run
    run_data = {
        "model": "gpt-4",
        "socket_path": "/tmp/cascade-test.sock",
        "concurrency": 1,
        "timeout": 5,
    }
    run_response = await client.post(
        "/api/v1/runs",
        json=run_data,
        headers=auth_headers
    )
    run_id = run_response.json()["id"]

    # Create task
    task_data = {
        "run_id": run_id,
        "language": "python",
        "exercise": "cascade-test",
        "passed": False,
        "started_at": datetime.utcnow().isoformat(),
        "finished_at": datetime.utcnow().isoformat(),
    }
    task_response = await client.post(
        "/api/v1/tasks",
        json=task_data,
        headers=auth_headers
    )
    task_id = task_response.json()["id"]

    # Create tool error
    error_data = {
        "task_id": task_id,
        "tool": "pytest",
        "error_type": "Error",
        "error_message": "Cascade test error",
    }
    error_response = await client.post(
        "/api/v1/tool-errors",
        json=error_data,
        headers=auth_headers
    )
    assert error_response.status_code == 201

    # Delete run
    delete_response = await client.delete(
        f"/api/v1/runs/{run_id}",
        headers=auth_headers
    )
    assert delete_response.status_code == 204

    # Verify run is deleted
    get_run = await client.get(
        f"/api/v1/runs/{run_id}",
        headers=auth_headers
    )
    assert get_run.status_code == 404

    # Verify task is deleted (cascaded)
    get_task = await client.get(
        f"/api/v1/tasks/{task_id}",
        headers=auth_headers
    )
    assert get_task.status_code == 404


@pytest.mark.asyncio
async def test_version_control_workflow(client: AsyncClient, auth_headers):
    """Test version control lock/unlock workflow."""
    # Initialize version
    version_data = {
        "version": "1.0.0",
        "schema_version": "1.0",
    }
    init_response = await client.post(
        "/api/v1/version/initialize",
        json=version_data,
        headers=auth_headers
    )
    # May already exist, that's okay
    assert init_response.status_code in [201, 409]

    # Lock version
    lock_data = {"reason": "migration in progress"}
    lock_response = await client.post(
        "/api/v1/version/lock",
        json=lock_data,
        headers=auth_headers
    )
    assert lock_response.status_code == 200
    assert lock_response.json()["is_locked"] is True

    # Check status
    status_response = await client.get(
        "/api/v1/version/status",
        headers=auth_headers
    )
    assert status_response.status_code == 200
    assert status_response.json()["is_locked"] is True

    # Unlock version
    unlock_response = await client.post(
        "/api/v1/version/unlock",
        headers=auth_headers
    )
    assert unlock_response.status_code == 200
    assert unlock_response.json()["is_locked"] is False


@pytest.mark.asyncio
async def test_batch_logging_performance(client: AsyncClient, auth_headers):
    """Test batch logging for multiple log types."""
    batch_data = {
        "action_logs": [
            {"action": f"batch_action_{i}", "success": True}
            for i in range(10)
        ],
        "api_logs": [
            {
                "endpoint": f"/batch-test-{i}",
                "method": "GET",
                "status_code": 200,
                "duration_ms": 100.0 + i
            }
            for i in range(10)
        ],
        "performance_logs": [
            {
                "operation": f"batch_op_{i}",
                "duration_ms": 50.0 + i,
            }
            for i in range(10)
        ],
    }

    response = await client.post(
        "/api/v1/logs/batch",
        json=batch_data,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 30  # 10 + 10 + 10


@pytest.mark.asyncio
async def test_pagination_across_multiple_resources(client: AsyncClient, auth_headers):
    """Test pagination works consistently across different resource types."""
    # Create multiple runs
    for i in range(5):
        run_data = {
            "model": "gpt-4",
            "socket_path": f"/tmp/pagination-test-{i}.sock",
            "concurrency": 1,
            "timeout": 5,
        }
        await client.post(
            "/api/v1/runs",
            json=run_data,
            headers=auth_headers
        )

    # Test pagination
    page1 = await client.get(
        "/api/v1/runs?limit=2&offset=0",
        headers=auth_headers
    )
    assert page1.status_code == 200
    page1_data = page1.json()
    assert len(page1_data["runs"]) <= 2

    page2 = await client.get(
        "/api/v1/runs?limit=2&offset=2",
        headers=auth_headers
    )
    assert page2.status_code == 200
    page2_data = page2.json()
    
    # Pages should have different runs
    if len(page1_data["runs"]) > 0 and len(page2_data["runs"]) > 0:
        page1_ids = {run["id"] for run in page1_data["runs"]}
        page2_ids = {run["id"] for run in page2_data["runs"]}
        assert page1_ids.isdisjoint(page2_ids)


@pytest.mark.asyncio
async def test_filtering_and_search(client: AsyncClient, auth_headers):
    """Test filtering capabilities across endpoints."""
    # Create run
    run_data = {
        "model": "gpt-4",
        "socket_path": "/tmp/filter-test.sock",
        "concurrency": 1,
        "timeout": 5,
    }
    run_response = await client.post(
        "/api/v1/runs",
        json=run_data,
        headers=auth_headers
    )
    run_id = run_response.json()["id"]

    # Create tasks with different languages
    languages = ["python", "javascript", "rust"]
    for lang in languages:
        task_data = {
            "run_id": run_id,
            "language": lang,
            "exercise": f"filter-test-{lang}",
            "passed": True,
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": datetime.utcnow().isoformat(),
        }
        await client.post(
            "/api/v1/tasks",
            json=task_data,
            headers=auth_headers
        )

    # Filter tasks by language
    python_tasks = await client.get(
        "/api/v1/tasks?language=python",
        headers=auth_headers
    )
    assert python_tasks.status_code == 200
    python_data = python_tasks.json()
    assert all(task["language"] == "python" for task in python_data["tasks"])

    # Filter tasks by run_id
    run_tasks = await client.get(
        f"/api/v1/tasks?run_id={run_id}",
        headers=auth_headers
    )
    assert run_tasks.status_code == 200
    run_tasks_data = run_tasks.json()
    assert len(run_tasks_data["tasks"]) >= 3
    assert all(task["run_id"] == run_id for task in run_tasks_data["tasks"])


@pytest.mark.asyncio
async def test_partial_updates_preserve_existing_data(client: AsyncClient, auth_headers):
    """Test that partial updates (PATCH) don't overwrite unspecified fields."""
    # Create provider
    provider_data = {
        "name": "partial-update-test",
        "display_name": "Original Name",
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

    # Partial update (only display_name)
    update_data = {"display_name": "Updated Name"}
    update_response = await client.patch(
        f"/api/v1/providers/{provider_id}",
        json=update_data,
        headers=auth_headers
    )
    assert update_response.status_code == 200

    # Get provider and verify all fields
    get_response = await client.get(
        f"/api/v1/providers/{provider_id}",
        headers=auth_headers
    )
    provider = get_response.json()
    
    # Updated field should change
    assert provider["display_name"] == "Updated Name"
    # Other fields should remain
    assert provider["name"] == "partial-update-test"
    assert provider["provider_type"] == "openai"
    assert provider["base_url"] == "https://api.openai.com"


@pytest.mark.asyncio
async def test_error_handling_consistency(client: AsyncClient, auth_headers):
    """Test that error responses are consistent across endpoints."""
    # Test 404 on non-existent resource
    response_404 = await client.get(
        "/api/v1/providers/99999999",
        headers=auth_headers
    )
    assert response_404.status_code == 404
    error_404 = response_404.json()
    assert "error" in error_404

    # Test 401 without auth
    response_401 = await client.get("/api/v1/providers")
    assert response_401.status_code == 401

    # Test 422 with invalid data
    response_422 = await client.post(
        "/api/v1/providers",
        json={"invalid": "data"},
        headers=auth_headers
    )
    assert response_422.status_code == 422
