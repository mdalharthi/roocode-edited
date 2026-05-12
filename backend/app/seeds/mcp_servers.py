"""
Seed default MCP server configurations.

These are the two default servers synced from mcp_settings.json.
On every startup the function checks if each server already exists;
it only creates missing ones, never overwrites existing data.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.mcp_server import McpServerConfig

logger = logging.getLogger("app.seeds")

# Default servers taken directly from the existing mcp_settings.json.
# The `config` dict mirrors the exact shape that McpHub / the frontend expects.
DEFAULT_MCP_SERVERS: list[dict] = [
    {
        "name": "com.figma.mcp/mcp",
        "config": {
            "type": "streamable-http",
            "url": "https://mcp.figma.com/mcp",
            "disabled": True,
            "alwaysAllow": [],
        },
        "created_by": "seed",
    },
    {
        "name": "figma",
        "config": {
            "type": "streamable-http",
            "url": "http://127.0.0.1:3845/mcp",
            "timeout": 600,
            "disabled": False,
            "alwaysAllow": [],
        },
        "created_by": "seed",
    },
]


async def seed_default_mcp_servers(db: AsyncSession) -> None:
    """
    Insert default MCP server entries if they are not already present.

    Safe to call on every startup — it is a no-op for records that exist.
    """
    for entry in DEFAULT_MCP_SERVERS:
        result = await db.execute(
            select(McpServerConfig).where(McpServerConfig.name == entry["name"])
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            server = McpServerConfig(
                name=entry["name"],
                config=entry["config"],
                created_by=entry.get("created_by"),
                updated_by=entry.get("created_by"),
            )
            db.add(server)
            logger.info(f"[seed] Created default MCP server: '{entry['name']}'")
        else:
            logger.debug(f"[seed] MCP server '{entry['name']}' already exists — skipping.")

    await db.commit()
