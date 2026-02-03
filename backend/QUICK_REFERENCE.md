# Backend API Quick Reference

Quick reference for developers integrating with the Code Assistant Backend API.

## 🚀 Getting Started

### Server Info

- **Base URL**: `http://localhost:8000/api/v1`
- **Docs**: `http://localhost:8000/docs`
- **Health**: `GET /api/v1/health`

### Authentication

All endpoints (except health) require API key:

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:8000/api/v1/providers
```

### Environment Variables

```bash
BACKEND_API_URL=http://localhost:8000/api/v1
BACKEND_API_KEY=3pYVmul0LcBSs7j-AYN4PA3jq2Q9UHlUTggb1Lup-Fk
```

---

## 📚 API Endpoints by Category

### 🔧 Health & Monitoring

```bash
# Check server health
GET /health
GET /health/detailed
```

### 👤 API Providers

```bash
# List providers (paginated)
GET /providers?limit=50&offset=0&provider_type=openai

# Get specific provider
GET /providers/{id}
GET /providers/by-name/{name}

# Create provider
POST /providers
{
  "name": "openai-default",
  "display_name": "OpenAI GPT-4",
  "provider_type": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key_encrypted": "your-api-key",
  "auth_type": "bearer",
  "created_by": "user@example.com"
}

# Update provider
PATCH /providers/{id}
{ "display_name": "New Name" }

# Delete provider
DELETE /providers/{id}
```

### 🔒 Version Control

```bash
# Get current version
GET /version

# Initialize version (first time only)
POST /version/initialize
{
  "extension_version": "1.0.0",
  "schema_version": 1,
  "migration_hash": "abc123"
}

# Verify version compatibility
POST /version/verify
{
  "extension_version": "1.0.0",
  "schema_version": 1
}

# Lock database (during migrations)
POST /version/lock
{ "reason": "Running database migration" }

# Unlock database
POST /version/unlock
{ "force": false }

# Check lock status
GET /version/status
```

### 🏃 Runs Management

```bash
# List runs
GET /runs?model=gpt-4&limit=50&offset=0

# Get run details
GET /runs/{id}

# Create run
POST /runs
{
  "model": "gpt-4",
  "description": "Test run",
  "socket_path": "/tmp/run.sock",
  "concurrency": 2,
  "timeout": 5,
  "settings": {}
}

# Update run
PATCH /runs/{id}
{ "description": "Updated description" }

# Finish run with results
POST /runs/{id}/finish
{
  "passed": 10,
  "failed": 2
}

# Delete run (cascade)
DELETE /runs/{id}
```

### ✅ Tasks Management

```bash
# List tasks
GET /tasks?run_id=1&language=python&passed=true&limit=50

# Get task details
GET /tasks/{id}

# Create task
POST /tasks
{
  "run_id": 1,
  "language": "python",
  "exercise": "hello-world",
  "passed": true,
  "started_at": "2025-11-26T10:00:00Z",
  "finished_at": "2025-11-26T10:01:00Z"
}

# Update task
PATCH /tasks/{id}
{ "passed": true }

# Get language scores (aggregated)
GET /tasks/language-scores?run_id=1
# Returns: [{ "language": "python", "total": 10, "passed": 8, "pass_rate": 80.0 }]

# Task Metrics
GET /task-metrics/{id}

POST /task-metrics
{
  "tokens_in": 1000,
  "tokens_out": 500,
  "tokens_context": 2000,
  "cache_writes": 100,
  "cache_reads": 50,
  "cost": 0.05,
  "duration": 1500,
  "tool_usage": {}
}

PATCH /task-metrics/{id}
{ "duration": 1600 }
```

### 📝 Logging

```bash
# Action Logs
GET /logs/actions?session_id=abc123&action_type=command
POST /logs/actions
{
  "session_id": "abc123",
  "action_type": "command",
  "action_name": "run_tests",
  "description": "Running unit tests",
  "result": "success",
  "action_metadata": {}
}

# API Logs
GET /logs/api?session_id=abc123&provider=openai
POST /logs/api
{
  "session_id": "abc123",
  "provider": "openai",
  "model": "gpt-4",
  "endpoint": "/v1/chat/completions",
  "method": "POST",
  "status_code": 200,
  "duration_ms": 1500,
  "tokens_used": 500
}

# Performance Logs
GET /logs/performance?session_id=abc123&operation_type=compile
POST /logs/performance
{
  "session_id": "abc123",
  "operation_name": "compile_typescript",
  "operation_type": "compile",
  "duration_ms": 2500,
  "cpu_usage": 45.5,
  "memory_usage_mb": 512.0
}

# User Interaction Logs
GET /logs/user-interactions?session_id=abc123
POST /logs/user-interactions
{
  "session_id": "abc123",
  "interaction_type": "button_click",
  "target_element": "run_button",
  "action": "click"
}

# File Operation Logs
GET /logs/file-operations?session_id=abc123&operation_type=read
POST /logs/file-operations
{
  "session_id": "abc123",
  "operation_type": "read",
  "file_path": "/src/main.ts",
  "file_size_bytes": 1024,
  "duration_ms": 10,
  "success": true
}

# Batch Logging (efficient for multiple logs)
POST /logs/batch
{
  "action_logs": [...],
  "api_logs": [...],
  "performance_logs": [...],
  "user_interaction_logs": [...],
  "file_operation_logs": [...]
}
```

---

## 🎯 Common Patterns

### Pagination

```bash
# All list endpoints support pagination
GET /runs?limit=50&offset=0
GET /tasks?limit=100&offset=100
```

### Filtering

```bash
# Most list endpoints support filtering
GET /runs?model=gpt-4
GET /tasks?run_id=1&language=python&passed=true
GET /logs/actions?session_id=abc123&action_type=command
```

### Partial Updates

```bash
# Use PATCH for partial updates (only send changed fields)
PATCH /runs/{id}
{ "description": "New description" }

# Not required to send all fields
```

### Error Responses

```json
{
	"detail": "Provider with id 999 not found"
}
```

Common status codes:

- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing API key)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## 💻 TypeScript Client Example

```typescript
import axios from "axios"

const client = axios.create({
	baseURL: process.env.BACKEND_API_URL,
	headers: {
		"X-API-Key": process.env.BACKEND_API_KEY,
	},
})

// List providers
const providers = await client.get("/providers")

// Create run
const run = await client.post("/runs", {
	model: "gpt-4",
	socket_path: "/tmp/run.sock",
	concurrency: 2,
	timeout: 5,
})

// Batch log
await client.post("/logs/batch", {
	action_logs: [{ session_id: "abc", action_type: "command", action_name: "test" }],
	performance_logs: [{ session_id: "abc", operation_name: "compile", duration_ms: 1500 }],
})
```

---

## 🔍 Useful Queries

### Get all failed tasks for a run

```bash
GET /tasks?run_id=1&passed=false
```

### Get language performance stats

```bash
GET /tasks/language-scores?run_id=1
```

### Get all API calls in a session

```bash
GET /logs/api?session_id=abc123
```

### Check if database is locked

```bash
GET /version/status
```

### Get detailed health with pool stats

```bash
GET /health/detailed
```

---

## 📖 Response Examples

### Provider Response

```json
{
	"id": 1,
	"name": "openai-default",
	"display_name": "OpenAI GPT-4",
	"provider_type": "openai",
	"base_url": "https://api.openai.com/v1",
	"auth_type": "bearer",
	"version": 1,
	"is_active": true,
	"created_at": "2025-11-26T10:00:00Z",
	"updated_at": "2025-11-26T10:00:00Z"
}
```

### Run Response

```json
{
	"id": 1,
	"model": "gpt-4",
	"description": "Test run",
	"socket_path": "/tmp/run.sock",
	"concurrency": 2,
	"timeout": 5,
	"passed": 10,
	"failed": 2,
	"settings": {},
	"created_at": "2025-11-26T10:00:00Z"
}
```

### Language Scores Response

```json
[
	{
		"language": "python",
		"total_tasks": 15,
		"passed_tasks": 12,
		"failed_tasks": 3,
		"pass_rate": 80.0
	},
	{
		"language": "typescript",
		"total_tasks": 10,
		"passed_tasks": 10,
		"failed_tasks": 0,
		"pass_rate": 100.0
	}
]
```

### Batch Response

```json
{
	"action_logs_created": 5,
	"api_logs_created": 3,
	"performance_logs_created": 2,
	"user_interaction_logs_created": 1,
	"file_operation_logs_created": 4,
	"total_created": 15,
	"errors": []
}
```

---

## 🛠️ Development Tips

1. **Use OpenAPI Docs**: Visit `http://localhost:8000/docs` for interactive testing
2. **Check Health First**: Always verify server is running with `/health`
3. **Use Batch Logging**: For multiple logs, use `/logs/batch` for better performance
4. **Handle Errors**: Check status codes and error messages in responses
5. **Paginate Large Lists**: Use `limit` and `offset` for large datasets
6. **Filter Before Paginating**: Apply filters to reduce data transfer
7. **Use Partial Updates**: PATCH endpoints only update provided fields
8. **Check Version Lock**: Before migrations, check `/version/status`

---

## 🔗 Additional Resources

- [Complete API Documentation](API_DESIGN.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
- [Setup Guide](README.md)
- [Migration Status](../BACKEND_MIGRATION_STATUS.md)
