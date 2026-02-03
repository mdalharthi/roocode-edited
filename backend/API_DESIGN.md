# FastAPI Backend - API Design & Implementation Plan

## Overview

This document outlines the complete API design for the Python FastAPI backend that will replace direct database connections from the TypeScript extension. The backend will handle all database operations, maintaining the same logic and functionality.

## Technology Stack

- **Framework**: FastAPI (async/await support)
- **ORM**: SQLAlchemy 2.0+ (async)
- **Migrations**: Alembic
- **Database**: PostgreSQL
- **Validation**: Pydantic V2
- **Authentication**: JWT tokens (optional API key fallback)
- **Connection Pooling**: asyncpg (fast async PostgreSQL driver)
- **Testing**: pytest + pytest-asyncio

## Database Schema Summary

### Core Tables

1. **ca_api_providers** - API provider configurations (OpenAI, Anthropic, etc.)
2. **ca_runs** - Evaluation run executions
3. **ca_tasks** - Individual tasks within runs
4. **ca_task_metrics** - Token usage, cost, duration metrics
5. **ca_tool_errors** - Tool error tracking
6. **ca_action_logs** - Comprehensive action logging
7. **ca_api_logs** - API request/response logging
8. **ca_performance_logs** - Performance metrics
9. **ca_user_interaction_logs** - User interaction tracking
10. **ca_file_operation_logs** - File operation metrics
11. **ca_extension_versions** - Version control and database locking

---

## API Endpoints Design

### Base URL: `/api/v1`

---

## 1. Health & System Endpoints

### `GET /health`

- **Description**: Health check endpoint
- **Response**:
    ```json
    {
    	"status": "healthy",
    	"database": "connected",
    	"version": "1.0.0",
    	"timestamp": "2025-01-15T10:30:00Z"
    }
    ```

### `GET /health/detailed`

- **Description**: Detailed health status with database pool stats
- **Response**:
    ```json
    {
    	"status": "healthy",
    	"database": {
    		"connected": true,
    		"pool_size": 20,
    		"active_connections": 5,
    		"idle_connections": 15
    	},
    	"version": "1.0.0",
    	"uptime_seconds": 3600
    }
    ```

---

## 2. API Provider Management

### `GET /providers`

- **Description**: Get all active API providers
- **Query Params**:
    - `provider_type` (optional): Filter by type (openai, anthropic, etc.)
    - `limit` (optional): Pagination limit
    - `offset` (optional): Pagination offset
- **Response**:
    ```json
    {
    	"providers": [
    		{
    			"id": 1,
    			"name": "openai-gpt4",
    			"display_name": "OpenAI GPT-4",
    			"provider_type": "openai",
    			"base_url": "https://api.openai.com/v1",
    			"auth_type": "api_key",
    			"rate_limit_requests_per_minute": 60,
    			"rate_limit_requests_per_hour": 1000,
    			"rate_limit_requests_per_day": 10000,
    			"config_metadata": {},
    			"version": 1,
    			"created_at": "2025-01-15T10:30:00Z",
    			"updated_at": "2025-01-15T10:30:00Z"
    		}
    	],
    	"total": 10,
    	"limit": 50,
    	"offset": 0
    }
    ```

### `GET /providers/{id}`

- **Description**: Get provider by ID
- **Path Params**: `id` (integer)
- **Response**: Single provider object or 404

### `GET /providers/by-name/{name}`

- **Description**: Get provider by name
- **Path Params**: `name` (string)
- **Response**: Single provider object or 404

### `POST /providers`

- **Description**: Create new provider
- **Request Body**:
    ```json
    {
    	"name": "custom-provider",
    	"display_name": "Custom Provider",
    	"provider_type": "custom",
    	"base_url": "https://api.example.com",
    	"api_key_encrypted": "encrypted_key_here",
    	"auth_type": "api_key",
    	"rate_limit_requests_per_minute": 60,
    	"rate_limit_requests_per_hour": 1000,
    	"rate_limit_requests_per_day": 10000,
    	"config_metadata": {}
    }
    ```
- **Response**: Created provider object with 201 status
- **Validation**:
    - Unique name constraint
    - Valid provider_type enum
    - Valid auth_type enum
    - Positive rate limits

### `PATCH /providers/{id}`

- **Description**: Update provider (partial update with COALESCE logic)
- **Path Params**: `id` (integer)
- **Request Body**: Partial provider object
- **Response**: Updated provider object

### `DELETE /providers/{id}`

- **Description**: Delete provider
- **Path Params**: `id` (integer)
- **Response**: 204 No Content

---

## 3. Runs Management

### `GET /runs`

- **Description**: Get all runs with optional filtering
- **Query Params**:
    - `limit` (default: 50, max: 100)
    - `offset` (default: 0)
    - `model` (optional): Filter by model
    - `passed` (optional): Filter by passed/failed status
- **Response**:
    ```json
    {
    	"runs": [
    		{
    			"id": 1,
    			"task_metrics_id": 10,
    			"model": "claude-3-opus",
    			"description": "Test run for feature X",
    			"settings": {},
    			"pid": 12345,
    			"socket_path": "/tmp/socket",
    			"concurrency": 2,
    			"timeout": 5,
    			"passed": 10,
    			"failed": 2,
    			"created_at": "2025-01-15T10:30:00Z",
    			"task_metrics": {
    				"id": 10,
    				"tokens_in": 1000,
    				"tokens_out": 500,
    				"cost": 0.05
    			}
    		}
    	],
    	"total": 100,
    	"limit": 50,
    	"offset": 0
    }
    ```

### `GET /runs/{id}`

- **Description**: Get run by ID with related data
- **Path Params**: `id` (integer)
- **Query Params**:
    - `include_tasks` (boolean): Include related tasks
    - `include_metrics` (boolean): Include task metrics
- **Response**: Single run object with optional relations

### `POST /runs`

- **Description**: Create new run
- **Request Body**:
    ```json
    {
    	"model": "claude-3-opus",
    	"description": "Test run",
    	"settings": {},
    	"socket_path": "/tmp/socket",
    	"concurrency": 2,
    	"timeout": 5
    }
    ```
- **Response**: Created run object with 201 status

### `PATCH /runs/{id}`

- **Description**: Update run
- **Path Params**: `id` (integer)
- **Request Body**: Partial run object
- **Response**: Updated run object

### `POST /runs/{id}/finish`

- **Description**: Finish run with aggregated metrics
- **Path Params**: `id` (integer)
- **Logic**:
    - Aggregate all task metrics (tokens, cost, duration)
    - Calculate passed/failed counts
    - Update run with final metrics
- **Response**:
    ```json
    {
    	"id": 1,
    	"passed": 10,
    	"failed": 2,
    	"task_metrics_id": 10,
    	"aggregated_metrics": {
    		"total_tokens_in": 5000,
    		"total_tokens_out": 2500,
    		"total_cost": 0.25,
    		"total_duration": 3600000
    	}
    }
    ```

### `DELETE /runs/{id}`

- **Description**: Delete run and cascade to related records
- **Path Params**: `id` (integer)
- **Logic**: Cascade delete to tasks, tool errors, etc.
- **Response**: 204 No Content

---

## 4. Tasks Management

### `GET /tasks`

- **Description**: Get tasks with filtering
- **Query Params**:
    - `run_id` (optional): Filter by run
    - `language` (optional): Filter by exercise language
    - `passed` (optional): Filter by pass/fail status
    - `limit`, `offset`: Pagination
- **Response**: Paginated list of tasks with metrics

### `GET /tasks/{id}`

- **Description**: Get task by ID
- **Path Params**: `id` (integer)
- **Response**: Single task object with metrics

### `POST /tasks`

- **Description**: Create new task
- **Request Body**:
    ```json
    {
    	"run_id": 1,
    	"language": "typescript",
    	"exercise": "fibonacci",
    	"passed": null,
    	"started_at": "2025-01-15T10:30:00Z"
    }
    ```
- **Response**: Created task with 201 status

### `PATCH /tasks/{id}`

- **Description**: Update task
- **Path Params**: `id` (integer)
- **Request Body**: Partial task object
- **Response**: Updated task object

### `GET /tasks/language-scores`

- **Description**: Get aggregated scores by language
- **Query Params**: `run_id` (optional)
- **Response**:
    ```json
    {
    	"scores": [
    		{
    			"language": "typescript",
    			"total_tasks": 20,
    			"passed": 18,
    			"failed": 2,
    			"pass_rate": 0.9
    		}
    	]
    }
    ```

---

## 5. Task Metrics Management

### `GET /task-metrics/{id}`

- **Description**: Get task metrics by ID
- **Path Params**: `id` (integer)
- **Response**: Task metrics object

### `POST /task-metrics`

- **Description**: Create task metrics
- **Request Body**:
    ```json
    {
    	"tokens_in": 1000,
    	"tokens_out": 500,
    	"tokens_context": 200,
    	"cache_writes": 100,
    	"cache_reads": 50,
    	"cost": 0.05,
    	"duration": 5000,
    	"tool_usage": {
    		"Bash": { "attempts": 5, "failures": 0 },
    		"Read": { "attempts": 10, "failures": 1 }
    	}
    }
    ```
- **Response**: Created metrics with 201 status

### `PATCH /task-metrics/{id}`

- **Description**: Update task metrics
- **Path Params**: `id` (integer)
- **Request Body**: Partial metrics object
- **Response**: Updated metrics

---

## 6. Tool Errors Tracking

### `GET /tool-errors`

- **Description**: Get tool errors with filtering
- **Query Params**:
    - `run_id` (optional)
    - `task_id` (optional)
    - `tool_name` (optional)
    - `limit`, `offset`
- **Response**: Paginated list of tool errors

### `POST /tool-errors`

- **Description**: Log tool error
- **Request Body**:
    ```json
    {
    	"run_id": 1,
    	"task_id": 10,
    	"tool_name": "Bash",
    	"error": "Command timeout after 30s"
    }
    ```
- **Response**: Created error with 201 status

---

## 7. Action Logs (Comprehensive Logging)

### `GET /logs/actions`

- **Description**: Get action logs
- **Query Params**:
    - `session_id` (optional)
    - `action_type` (optional)
    - `status` (optional)
    - `user_id` (optional)
    - `workspace_id` (optional)
    - `start_date`, `end_date` (optional): Date range filtering
    - `limit`, `offset`
- **Response**: Paginated action logs

### `POST /logs/actions`

- **Description**: Create action log
- **Request Body**:
    ```json
    {
    	"session_id": "sess_abc123",
    	"action_type": "command_execution",
    	"action_name": "git_commit",
    	"user_id": "user_123",
    	"workspace_id": "workspace_456",
    	"status": "success",
    	"response_code": 200,
    	"duration": 1500,
    	"input_data": {},
    	"output_data": {},
    	"metadata": {}
    }
    ```
- **Response**: Created log with 201 status

### `PATCH /logs/actions/{id}`

- **Description**: Update action log (for updating status/duration after completion)
- **Path Params**: `id` (integer)
- **Request Body**: Partial log object
- **Response**: Updated log

---

## 8. API Logs

### `GET /logs/api`

- **Description**: Get API call logs
- **Query Params**:
    - `action_log_id` (optional)
    - `provider` (optional)
    - `model` (optional)
    - `status_code` (optional)
    - `start_date`, `end_date`
    - `limit`, `offset`
- **Response**: Paginated API logs

### `POST /logs/api`

- **Description**: Log API call
- **Request Body**:
    ```json
    {
    	"action_log_id": 100,
    	"method": "POST",
    	"url": "https://api.anthropic.com/v1/messages",
    	"provider": "anthropic",
    	"model": "claude-3-opus",
    	"request_headers": {},
    	"request_body": {},
    	"response_headers": {},
    	"response_body": {},
    	"status_code": 200,
    	"tokens_used": 1500,
    	"cost": 0.05,
    	"retry_count": 0
    }
    ```
- **Response**: Created log with 201 status

---

## 9. Performance Logs

### `GET /logs/performance`

- **Description**: Get performance logs
- **Query Params**:
    - `action_log_id` (optional)
    - `operation_type` (optional)
    - `min_execution_time` (optional): Filter slow operations
    - `start_date`, `end_date`
    - `limit`, `offset`
- **Response**: Paginated performance logs

### `POST /logs/performance`

- **Description**: Log performance metrics
- **Request Body**:
    ```json
    {
    	"action_log_id": 100,
    	"operation_type": "file_read",
    	"memory_usage": 524288000,
    	"cpu_usage": 45.5,
    	"execution_time": 250,
    	"throughput": 100.0,
    	"resource_metrics": {}
    }
    ```
- **Response**: Created log with 201 status

---

## 10. User Interaction Logs

### `GET /logs/user-interactions`

- **Description**: Get user interaction logs
- **Query Params**:
    - `action_log_id` (optional)
    - `interaction_type` (optional)
    - `component` (optional)
    - `start_date`, `end_date`
    - `limit`, `offset`
- **Response**: Paginated interaction logs

### `POST /logs/user-interactions`

- **Description**: Log user interaction
- **Request Body**:
    ```json
    {
    	"action_log_id": 100,
    	"interaction_type": "command",
    	"component": "chat_input",
    	"context": {},
    	"result": "success"
    }
    ```
- **Response**: Created log with 201 status

---

## 11. File Operation Logs

### `GET /logs/file-operations`

- **Description**: Get file operation logs
- **Query Params**:
    - `action_log_id` (optional)
    - `operation` (optional): write, read, delete, rename
    - `file_path` (optional): Search by path
    - `mode` (optional): edit or create
    - `start_date`, `end_date`
    - `limit`, `offset`
- **Response**: Paginated file operation logs

### `POST /logs/file-operations`

- **Description**: Log file operation
- **Request Body**:
    ```json
    {
    	"action_log_id": 100,
    	"file_path": "/path/to/file.ts",
    	"operation": "write",
    	"mode": "edit",
    	"version_before": "hash_before",
    	"version_after": "hash_after",
    	"previous_total_lines": 100,
    	"new_total_lines": 110,
    	"new_lines_added": 15,
    	"lines_removed": 5,
    	"lines_modified": 3,
    	"non_empty_lines_before": 80,
    	"non_empty_lines_after": 88,
    	"content_type": "typescript",
    	"metadata": {}
    }
    ```
- **Response**: Created log with 201 status

---

## 12. Version Control & Database Locking

### `GET /version`

- **Description**: Get current database version
- **Response**:
    ```json
    {
    	"id": 1,
    	"extension_version": "3.25.8",
    	"schema_version": 5,
    	"migration_hash": "abc123def456",
    	"is_locked": false,
    	"locked_at": null,
    	"locked_reason": null,
    	"last_synced_at": "2025-01-15T10:30:00Z",
    	"created_at": "2025-01-01T00:00:00Z",
    	"updated_at": "2025-01-15T10:30:00Z"
    }
    ```

### `POST /version/verify`

- **Description**: Verify version match
- **Request Body**:
    ```json
    {
    	"extension_version": "3.25.8",
    	"migration_hash": "abc123def456"
    }
    ```
- **Response**:
    ```json
    {
    	"match": true,
    	"requires_migration": false,
    	"current_version": "3.25.8",
    	"database_version": "3.25.8"
    }
    ```

### `POST /version/lock`

- **Description**: Lock database due to version mismatch
- **Request Body**:
    ```json
    {
    	"reason": "Version mismatch: extension 3.26.0, database 3.25.8"
    }
    ```
- **Response**: Updated version object with is_locked=true

### `POST /version/unlock`

- **Description**: Unlock database
- **Response**: Updated version object with is_locked=false

### `GET /version/status`

- **Description**: Check if database is locked
- **Response**:
    ```json
    {
    	"is_locked": false,
    	"locked_at": null,
    	"locked_reason": null
    }
    ```

### `POST /version/initialize`

- **Description**: Initialize version record (first time setup)
- **Request Body**:
    ```json
    {
    	"extension_version": "3.25.8",
    	"schema_version": 5,
    	"migration_hash": "abc123def456"
    }
    ```
- **Response**: Created version record

### `PUT /version`

- **Description**: Update version record
- **Request Body**: Partial version object
- **Response**: Updated version

---

## 13. Batch Operations

### `POST /logs/batch`

- **Description**: Batch create logs (for performance)
- **Request Body**:
    ```json
    {
      "action_logs": [...],
      "api_logs": [...],
      "performance_logs": [...],
      "file_operation_logs": [...],
      "user_interaction_logs": [...]
    }
    ```
- **Response**:
    ```json
    {
    	"created_counts": {
    		"action_logs": 10,
    		"api_logs": 5,
    		"performance_logs": 10,
    		"file_operation_logs": 3,
    		"user_interaction_logs": 8
    	}
    }
    ```

---

## Error Responses

All endpoints follow consistent error response format:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Invalid request body",
		"details": [
			{
				"field": "name",
				"message": "Field is required"
			}
		]
	}
}
```

### Error Codes:

- `VALIDATION_ERROR` (400)
- `NOT_FOUND` (404)
- `CONFLICT` (409) - For unique constraint violations
- `DATABASE_ERROR` (500)
- `INTERNAL_SERVER_ERROR` (500)

---

## Authentication & Security

### API Key Authentication

- Header: `X-API-Key: your_api_key_here`
- Or: `Authorization: Bearer your_api_key_here`

### JWT Authentication (Optional)

- Header: `Authorization: Bearer <jwt_token>`
- Token expiry: Configurable (default 24 hours)

### Security Features

1. Rate limiting per endpoint
2. CORS configuration for extension origin
3. Request/response logging
4. Input validation and sanitization
5. SQL injection prevention (SQLAlchemy ORM)
6. Encrypted API key storage (for provider configs)

---

## Performance Optimizations

1. **Connection Pooling**: asyncpg with configurable pool size
2. **Batch Operations**: Bulk insert endpoints for logging
3. **Pagination**: All list endpoints support limit/offset
4. **Indexing**: Database indexes on frequently queried fields
5. **Caching**: Optional Redis cache for provider configs
6. **Async Operations**: Full async/await throughout
7. **Query Optimization**: Eager loading for related data

---

## Migration Strategy

### Phase 1: Backend Development

1. Setup FastAPI project structure
2. Implement SQLAlchemy models
3. Create Alembic migrations
4. Implement all endpoints
5. Add tests

### Phase 2: Parallel Running

1. Deploy backend alongside existing DB connections
2. Extension can use both (feature flag)
3. Log comparison for validation

### Phase 3: Full Migration

1. Replace all DB calls with API calls
2. Remove database dependencies from extension
3. Update environment variables

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=4
LOG_LEVEL=info

# Security
API_KEY=your_secure_api_key_here
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRY_HOURS=24

# CORS
ALLOWED_ORIGINS=vscode-extension://claude-code,http://localhost:3000

# Connection Pool
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=100
```

---

## Monitoring & Observability

1. **Health Checks**: `/health` and `/health/detailed`
2. **Metrics**: Prometheus metrics endpoint `/metrics`
3. **Logging**: Structured JSON logging
4. **Tracing**: OpenTelemetry support (optional)
5. **Database Monitoring**: Connection pool stats

---

## Deployment Considerations

### Docker Support

- Dockerfile for containerization
- docker-compose for local development
- Health check configuration

### Production Deployment

- Gunicorn with Uvicorn workers
- Nginx reverse proxy
- SSL/TLS termination
- Environment-based configuration
- Database connection pooling
- Graceful shutdown handling

---

## Testing Strategy

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test API endpoints
3. **Database Tests**: Test with test database
4. **Performance Tests**: Load testing for batch operations
5. **Migration Tests**: Test Alembic migrations

---

## Next Steps

1. Create project structure
2. Implement SQLAlchemy models
3. Setup Alembic migrations
4. Implement API endpoints
5. Add authentication middleware
6. Write tests
7. Create Docker setup
8. Document deployment process
