# Code Assistant Backend API

A standalone Python FastAPI backend that handles all database operations for the Code Assistant VSCode extension.

## 🎯 Overview

This backend replaces direct PostgreSQL connections in the TypeScript extension with a REST API, providing:

- **45+ REST endpoints** covering 11 database tables
- **Async architecture** with SQLAlchemy 2.0 and asyncpg
- **Connection pooling** with health checks and automatic retries
- **Fernet encryption** for sensitive API keys
- **Simple API key authentication**
- **Comprehensive logging** and error handling

## 📁 Project Structure

```
backend/
├── app/
│   ├── models/              # SQLAlchemy ORM models (11 tables)
│   ├── schemas/             # Pydantic request/response models
│   ├── api/v1/              # API route handlers
│   ├── core/                # Security, middleware, exceptions
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection & pooling
│   └── main.py              # FastAPI application entry
├── alembic/                 # Database migrations
├── tests/                   # Test suite
├── requirements.txt         # Production dependencies
├── requirements-dev.txt     # Development dependencies
├── .env.example             # Environment variable template
├── Dockerfile               # Docker image
├── docker-compose.yml       # Docker composition
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- pip or poetry

### 1. Clone and Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate secure keys
python -c "import secrets; print(f'API_KEY={secrets.token_urlsafe(32)}')" >> .env
python -c "from cryptography.fernet import Fernet; print(f'ENCRYPTION_KEY={Fernet.generate_key().decode()}')" >> .env

# Edit .env and set your DATABASE_URL
nano .env
```

### 3. Initialize Database

```bash
# The application will automatically create tables on startup
# Or use Alembic for migrations (coming soon)
```

### 4. Run the Server

```bash
# Development mode with auto-reload
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc
- **Health**: http://localhost:8000/api/v1/health

## 🔐 Authentication

All API endpoints (except `/health`) require authentication via API key:

```bash
curl -H "X-API-Key: your_api_key_here" http://localhost:8000/api/v1/providers
```

## 📊 Database Schema

### Core Tables (11 total)

1. **ca_api_providers** - API provider configurations (OpenAI, Anthropic, etc.)
2. **ca_runs** - Evaluation run executions
3. **ca_tasks** - Individual tasks within runs
4. **ca_task_metrics** - Token usage, cost, and duration metrics
5. **ca_tool_errors** - Tool error tracking
6. **ca_action_logs** - Comprehensive action logging
7. **ca_api_logs** - API request/response logging
8. **ca_performance_logs** - Performance metrics
9. **ca_user_interaction_logs** - User interaction tracking
10. **ca_file_operation_logs** - File operation metrics
11. **ca_extension_versions** - Version control and database locking

## 🔌 API Endpoints

### Health & Monitoring

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with pool stats

### API Providers (7 endpoints)

- `GET /api/v1/providers` - List all providers
- `GET /api/v1/providers/{id}` - Get provider by ID
- `GET /api/v1/providers/by-name/{name}` - Get provider by name
- `POST /api/v1/providers` - Create provider
- `PATCH /api/v1/providers/{id}` - Update provider
- `DELETE /api/v1/providers/{id}` - Delete provider

### Runs Management (6 endpoints)

- `GET /api/v1/runs` - List runs (paginated)
- `GET /api/v1/runs/{id}` - Get run by ID
- `POST /api/v1/runs` - Create run
- `PATCH /api/v1/runs/{id}` - Update run
- `POST /api/v1/runs/{id}/finish` - Finish run with aggregated metrics
- `DELETE /api/v1/runs/{id}` - Delete run (cascade)

### Tasks Management (5 endpoints)

- `GET /api/v1/tasks` - List tasks
- `GET /api/v1/tasks/{id}` - Get task by ID
- `POST /api/v1/tasks` - Create task
- `PATCH /api/v1/tasks/{id}` - Update task
- `GET /api/v1/tasks/language-scores` - Get aggregated scores by language

### Logging Endpoints (10+ endpoints)

- `GET/POST /api/v1/logs/actions` - Action logs
- `GET/POST /api/v1/logs/api` - API call logs
- `GET/POST /api/v1/logs/performance` - Performance logs
- `GET/POST /api/v1/logs/user-interactions` - User interaction logs
- `GET/POST /api/v1/logs/file-operations` - File operation logs
- `POST /api/v1/logs/batch` - Batch create logs

### Version Control (7 endpoints)

- `GET /api/v1/version` - Get current version
- `POST /api/v1/version/verify` - Verify version match
- `POST /api/v1/version/lock` - Lock database
- `POST /api/v1/version/unlock` - Unlock database
- `GET /api/v1/version/status` - Check lock status

See [API_DESIGN.md](API_DESIGN.md) for complete API documentation.

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Using Docker

```bash
# Build image
docker build -t code-assistant-backend .

# Run container
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  --name backend \
  code-assistant-backend
```

## 🧪 Testing

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_providers.py
```

## 🛠️ Development

### Code Quality

```bash
# Format code with black
black app tests

# Lint with ruff
ruff check app tests

# Type checking with mypy
mypy app
```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## 📝 Environment Variables

| Variable          | Description                    | Default | Required |
| ----------------- | ------------------------------ | ------- | -------- |
| `DATABASE_URL`    | PostgreSQL connection string   | -       | Yes      |
| `API_KEY`         | API authentication key         | -       | Yes      |
| `ENCRYPTION_KEY`  | Fernet encryption key (base64) | -       | Yes      |
| `HOST`            | Server host                    | 0.0.0.0 | No       |
| `PORT`            | Server port                    | 8000    | No       |
| `WORKERS`         | Number of workers              | 4       | No       |
| `LOG_LEVEL`       | Logging level                  | info    | No       |
| `DEBUG`           | Debug mode                     | false   | No       |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | \*      | No       |
| `DB_POOL_SIZE`    | Connection pool size           | 20      | No       |
| `DB_MAX_OVERFLOW` | Max overflow connections       | 10      | No       |

## 🔗 Extension Integration

### Extension Configuration

Update your extension's `.env` file:

```bash
# Backend API configuration
BACKEND_API_URL=http://localhost:8000/api/v1
BACKEND_API_KEY=your_secure_api_key_here

# Optional: Feature flag
USE_BACKEND_API=true
```

### Migration Strategy

1. **Phase 1**: Run backend alongside existing database connections
2. **Phase 2**: Create HTTP client layer in extension
3. **Phase 3**: Gradually replace database calls with API calls
4. **Phase 4**: Remove database dependencies from extension

## 📈 Performance

- **Connection Pooling**: 20 connections with 10 overflow
- **Async I/O**: Non-blocking database operations
- **Batch Operations**: Bulk insert endpoints for logging
- **Pagination**: All list endpoints support limit/offset
- **Health Checks**: Automatic connection validation

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# View pool statistics
curl http://localhost:8000/api/v1/health/detailed
```

### Authentication Errors

```bash
# Verify API key
curl -H "X-API-Key: your_key" http://localhost:8000/api/v1/health
```

### Migration Errors

```bash
# Reset database (DEV ONLY!)
alembic downgrade base
alembic upgrade head
```

## 📚 Additional Resources

- [API Design Documentation](API_DESIGN.md)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

## 🤝 Contributing

1. Follow PEP 8 style guide
2. Write tests for new features
3. Update documentation
4. Run code quality checks before committing

## 📄 License

See main project LICENSE file.

## ✨ Status

**Current Implementation Status**: 🚧 In Progress

### ✅ Completed

- Project structure and configuration
- Database connection layer with async support
- All 11 SQLAlchemy ORM models
- Core utilities (security, exceptions, middleware, logging)
- Main FastAPI application
- Health check endpoints
- API dependencies and common schemas
- API provider schemas

### 🚧 In Progress

- Remaining Pydantic schemas
- API endpoint implementations
- Alembic migrations
- Docker setup
- Comprehensive tests

### 📋 TODO

- Complete all 45+ API endpoints
- Add comprehensive test suite
- Add Docker and docker-compose files
- Create migration scripts
- Add performance monitoring
- Add API rate limiting (optional)
- Add Prometheus metrics (optional)
