# Docker Deployment Guide

Complete guide for deploying the Code Assistant Backend using Docker and Docker Compose.

## Quick Start

### Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 1.29+ installed
- Access to external PostgreSQL database (enterprise)
- `code_assistant` database created on PostgreSQL server
- 2GB+ available RAM
- 2GB+ available disk space

### Development Deployment

```bash
# Navigate to backend directory
cd backend

# Start the backend service
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop service
docker-compose down
```

### First Time Setup

```bash
# Navigate to backend directory
cd backend

# Build and start service
docker-compose up --build -d

# Check service status
docker-compose ps

# Wait for health check to pass (30-60 seconds)
watch docker-compose ps

# Verify backend is healthy
curl http://localhost:8000/api/v1/health

# Test API endpoint
curl -H "X-API-Key: 3pYVmul0LcBSs7j-AYN4PA3jq2Q9UHlUTggb1Lup-Fk" \
  http://localhost:8000/api/v1/providers
```

## Environment Variables

Create a `.env` file in the backend directory for custom configuration:

```env
# API Security
BACKEND_API_KEY=your-secure-api-key-here
ENCRYPTION_KEY=your-secure-encryption-key-here

# Database Connection (External PostgreSQL)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/code_assistant

# Backend Configuration
DEBUG=false
LOG_LEVEL=info
ALLOWED_ORIGINS=*
```

## Service Architecture

### Backend Service

- **Image**: `quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:0.0.1`
- **Platform**: linux/amd64
- **Port**: 8000
- **Database**: Connects to external PostgreSQL server at `localhost:5432`
- **Health Check**: Every 30 seconds
- **Restart Policy**: Unless stopped manually

**Note**: This setup connects to an external enterprise PostgreSQL database. The DATABASE_URL environment variable should point to your PostgreSQL server endpoint accessible from the container.

## Common Operations

### View Logs

```bash
# Backend logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Follow logs with timestamps
docker-compose logs -f --timestamps backend
```

### Service Management

```bash
# Start service
docker-compose up -d

# Stop service
docker-compose down

# Restart service
docker-compose restart backend

# Rebuild and restart
docker-compose up --build -d backend

# View running service
docker-compose ps

# View resource usage
docker stats code-assistant-backend
```

### Database Operations

Database operations should be performed on the external PostgreSQL server:

```bash
# Connect to PostgreSQL (replace <postgres-host> with actual hostname)
psql -h <postgres-host> -U postgres -d code_assistant

# Run SQL query
psql -h <postgres-host> -U postgres -d code_assistant -c "SELECT COUNT(*) FROM ca_api_providers;"

# Backup database
pg_dump -h <postgres-host> -U postgres code_assistant > backup.sql

# Restore database
psql -h <postgres-host> -U postgres code_assistant < backup.sql

# With password environment variable
PGPASSWORD=postgres pg_dump -h <postgres-host> -U postgres code_assistant > backup.sql
```

### Container Management

```bash
# Restart backend container
docker-compose restart

# Rebuild and restart
docker-compose up --build -d

# Stop backend
docker-compose down

# Remove container and rebuild
docker-compose down
docker-compose up --build -d
```

## Health Checks

### Backend Health

```bash
# Basic health check
curl http://localhost:8000/api/v1/health

# Expected response (healthy):
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0",
  "timestamp": "2025-11-26T..."
}

# Detailed health check
curl http://localhost:8000/api/v1/health/detailed
```

### Database Health

Check the external PostgreSQL database:

```bash
# Check if PostgreSQL is ready (replace <postgres-host> with actual hostname)
pg_isready -h <postgres-host> -p 5432

# Expected output:
# <postgres-host>:5432 - accepting connections

# Test database connection
psql -h <postgres-host> -U postgres -d code_assistant -c "SELECT 1;"

# Or with password
PGPASSWORD=postgres psql -h <postgres-host> -U postgres -d code_assistant -c "SELECT 1;"
```

### Container Health

```bash
# Check health status
docker-compose ps

# Healthy output:
# code-assistant-backend   running (healthy)

# View health check logs
docker inspect --format='{{json .State.Health}}' code-assistant-backend | jq

# Check container is running
docker ps | grep code-assistant-backend
```

## Troubleshooting

### Backend Won't Start

**Problem**: Backend container exits or restarts repeatedly

**Solutions**:

```bash
# Check logs for errors
docker-compose logs backend

# Check database connection environment variable
docker-compose exec backend env | grep DATABASE_URL

# Verify network connectivity to database
docker-compose exec backend ping <postgres-host>

# Rebuild without cache
docker-compose build --no-cache backend
docker-compose up -d
```

### Database Connection Issues

**Problem**: Backend can't connect to external database

**Solutions**:

```bash
# 1. Verify PostgreSQL is accessible from container
docker-compose exec backend ping <postgres-host>

# 2. Test database connection from container
docker-compose exec backend bash
# Inside container:
apt-get update && apt-get install -y postgresql-client
psql -h <postgres-host> -U postgres -d code_assistant

# 3. Check DATABASE_URL is correct
docker-compose exec backend env | grep DATABASE_URL

# 4. Verify firewall rules allow container to reach database
# Contact your network admin if needed

# 5. Check backend logs for connection errors
docker-compose logs backend | grep -i database

# 6. Verify PostgreSQL accepts connections
# Check pg_hba.conf on database server for proper access rules
```

### Port Already in Use

**Problem**: Port 8000 already in use

**Solutions**:

```bash
# Find what's using the port
lsof -i :8000

# Kill the process (macOS/Linux)
lsof -ti:8000 | xargs kill -9

# Or change ports in docker-compose.yml
ports:
  - "8001:8000"  # Use 8001 on host instead
```

### Image Pull Issues

**Problem**: Cannot pull image from enterprise registry

**Solutions**:

```bash
# Login to enterprise registry
docker login quaynonprod.alinma.internal

# Pull image manually
docker pull quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:0.0.1

# If still failing, build locally
docker-compose build --no-cache backend
```

### Out of Disk Space

**Problem**: Docker runs out of disk space

**Solutions**:

```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a

# Remove old images
docker images | grep code_assistant
docker rmi <old-image-id>
```

### Slow Performance

**Problem**: Container running slowly

**Solutions**:

```bash
# Check resource usage
docker stats code-assistant-backend

# Allocate more resources in Docker Desktop settings
# - CPU: 2+ cores recommended
# - Memory: 2GB+ recommended

# Check for slow database queries in logs
docker-compose logs backend | grep -i "slow"
```

## Production Deployment

### Security Hardening

1. **Use secure credentials**:

```env
DATABASE_URL=postgresql+asyncpg://secure_user:strong_password@postgres-host:5432/code_assistant
BACKEND_API_KEY=<strong-random-key-from-secrets-manager>
ENCRYPTION_KEY=<strong-random-key-from-secrets-manager>
```

2. **Limit CORS origins**:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

3. **Use secrets management**:

```bash
# Use environment-specific secrets
# Never commit .env files to version control
# Use enterprise secrets manager (Vault, AWS Secrets Manager, etc.)
```

4. **Enable TLS/SSL**:

- Deploy behind nginx reverse proxy with SSL
- Use valid SSL certificates
- Enforce HTTPS only

### Resource Limits

Update `docker-compose.yml` to add resource limits:

```yaml
backend:
    deploy:
        resources:
            limits:
                cpus: "2"
                memory: 2G
            reservations:
                cpus: "1"
                memory: 1G
```

### Monitoring

```bash
# View resource usage
docker stats code-assistant-backend

# Check logs for errors
docker-compose logs --since 24h backend | grep ERROR

# Export metrics for monitoring tools
# Configure Prometheus, Grafana, or enterprise monitoring solution

# View container health
watch docker-compose ps
```

## Enterprise Deployment

### Building and Tagging

```bash
# Build image
docker build -t quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:0.0.1 .

# Tag for different environments
docker tag quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:0.0.1 \
  quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:latest

# Push to registry
docker push quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:0.0.1
```

### Deployment Process

```bash
# 1. Pull latest image
docker-compose pull

# 2. Stop current container
docker-compose down

# 3. Start new container
docker-compose up -d

# 4. Verify health
curl http://localhost:8000/api/v1/health

# 5. Check logs for errors
docker-compose logs --tail=100 backend
```

### Rolling Updates

```bash
# Zero-downtime deployment (requires load balancer)
docker-compose up -d --no-deps --build backend

# Verify new container is healthy before removing old one
docker ps -a
```

## Advanced Configuration

### Custom Network Configuration

```yaml
networks:
    backend-network:
        driver: bridge
        ipam:
            config:
                - subnet: 172.28.0.0/16
```

### Volume Mounts

```yaml
volumes:
    # Mount logs directory
    - ./logs:/app/logs
    # Mount config files
    - ./config:/app/config:ro
```

### Environment-Specific Configs

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Maintenance

### Regular Tasks

```bash
# Daily: Check logs for errors
docker-compose logs --since 24h | grep ERROR

# Weekly: Check container health
docker-compose ps
docker stats code-assistant-backend

# Monthly: Update image
docker-compose pull
docker-compose up -d

# Quarterly: Clean up old resources
docker system prune -a
```

### Database Maintenance

Database maintenance should be performed on the external PostgreSQL server according to your enterprise DBA procedures.

### Log Rotation

```bash
# Configure Docker log rotation in daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Restart Docker daemon
sudo systemctl restart docker
```

## Support

### Getting Help

- Check logs: `docker-compose logs -f backend`
- View health: `docker-compose ps`
- Inspect container: `docker inspect code-assistant-backend`
- Access shell: `docker-compose exec backend bash`

### Useful Commands

```bash
# Follow all logs with timestamps
docker-compose logs -f --timestamps backend

# Check disk usage
docker system df -v

# Export current configuration
docker-compose config

# Validate compose file
docker-compose config --quiet

# View container processes
docker-compose top

# Execute command in container
docker-compose exec backend python -c "import sys; print(sys.version)"
```

### Common Issues

| Issue                 | Command                                            | Expected Output          |
| --------------------- | -------------------------------------------------- | ------------------------ |
| Container won't start | `docker-compose logs backend`                      | Check for error messages |
| Can't connect to DB   | `docker-compose exec backend ping <postgres-host>` | Packets received         |
| Health check failing  | `curl http://localhost:8000/api/v1/health`         | `{"status": "healthy"}`  |
| High memory usage     | `docker stats code-assistant-backend`              | Check MEM USAGE %        |

---

**Last Updated**: November 26, 2025
**Version**: 1.0.0
**Docker Image**: `quaynonprod.alinma.internal/alinmagpt/code_assistant_backend:0.0.1`
