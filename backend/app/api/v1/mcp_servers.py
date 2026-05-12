"""
MCP Servers endpoints - CRUD operations for MCP server configurations.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.mcp_server import McpServerConfig
from app.schemas.mcp_server import (
    McpServerCreate,
    McpServerUpdate,
    McpServerResponse,
    McpServerListResponse,
)
from app.core.security import verify_api_key
from app.core.exceptions import NotFoundException, ConflictException

router = APIRouter()


@router.get("/mcp_servers", response_model=McpServerListResponse)
async def list_mcp_servers(
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List all MCP servers. Ensures default servers exist before returning."""
    # Always ensure defaults exist - seed_default_mcp_servers is idempotent
    from app.seeds.mcp_servers import seed_default_mcp_servers
    await seed_default_mcp_servers(db)

    query = select(McpServerConfig).order_by(McpServerConfig.name)
    result = await db.execute(query)
    servers = result.scalars().all()
    total = len(servers)

    return McpServerListResponse(
        servers=[McpServerResponse.model_validate(s) for s in servers],
        total=total,
    )


@router.get("/mcp_servers/{server_id}", response_model=McpServerResponse)
async def get_mcp_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Get MCP server by ID."""
    result = await db.execute(select(McpServerConfig).where(McpServerConfig.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise NotFoundException(f"Server with id {server_id} not found")

    return McpServerResponse.model_validate(server)


@router.post("/mcp_servers", response_model=McpServerResponse, status_code=201)
async def create_mcp_server(
    server_data: McpServerCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new MCP server. Returns existing server if already exists by name."""
    result = await db.execute(select(McpServerConfig).where(McpServerConfig.name == server_data.name))
    existing_server = result.scalar_one_or_none()
    
    if existing_server:
        return McpServerResponse.model_validate(existing_server)
    
    server = McpServerConfig(
        name=server_data.name,
        config=server_data.config,
        created_by=server_data.created_by,
        updated_by=server_data.created_by,
    )

    try:
        db.add(server)
        await db.commit()
        await db.refresh(server)
    except IntegrityError as e:
        await db.rollback()
        if "unique" in str(e).lower():
            raise ConflictException(f"Server with name '{server_data.name}' already exists")
        raise

    return McpServerResponse.model_validate(server)


@router.patch("/mcp_servers/{server_name}", response_model=McpServerResponse)
async def update_mcp_server(
    server_name: str,
    server_data: McpServerUpdate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Update an existing MCP server config."""
    result = await db.execute(select(McpServerConfig).where(McpServerConfig.name == server_name))
    server = result.scalar_one_or_none()

    if not server:
        raise NotFoundException(f"Server with name '{server_name}' not found")

    update_data = server_data.model_dump(exclude_unset=True)
    update_data["version"] = server.version + 1

    for key, value in update_data.items():
        setattr(server, key, value)

    try:
        await db.commit()
        await db.refresh(server)
    except IntegrityError as e:
        await db.rollback()
        raise ConflictException(f"Update conflict: {str(e)}")

    return McpServerResponse.model_validate(server)


@router.delete("/mcp_servers/{server_name}", status_code=204)
async def delete_mcp_server(
    server_name: str,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Delete an MCP server config."""
    result = await db.execute(select(McpServerConfig).where(McpServerConfig.name == server_name))
    server = result.scalar_one_or_none()

    if not server:
        raise NotFoundException(f"Server with name '{server_name}' not found")

    await db.delete(server)
    await db.commit()

    return None
