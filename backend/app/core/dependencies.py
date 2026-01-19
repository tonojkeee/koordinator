"""
Dependency Injection Providers

FastAPI dependency providers using @lru_cache() for singletons
and factory functions for request-scoped dependencies.

This replaces the need for complex DI containers in a monolith.
"""

from functools import lru_cache
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, TYPE_CHECKING

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.events import EventBus, event_bus
from app.core.redis_manager import redis_manager
from app.core.websocket_manager import websocket_manager

# Type checking for circular imports
if TYPE_CHECKING:
    from app.core.config import Settings
    from app.core.models import SystemSetting
    from app.modules.admin.service import AdminService, SystemSettingService


# ============================================================================
# SINGLETONS (cached for application lifetime)
# ============================================================================

@lru_cache()
def get_settings() -> "Settings":
    """Get application settings (singleton)"""
    from app.core.config import get_settings as _get_settings
    return _get_settings()


@lru_cache()
def get_event_bus() -> EventBus:
    """Get event bus singleton"""
    return event_bus


@lru_cache()
def get_websocket_manager() -> "websocket_manager":
    """Get WebSocket manager singleton"""
    return websocket_manager


@lru_cache()
def get_redis_manager() -> "redis_manager":
    """Get Redis manager singleton"""
    return redis_manager


# ============================================================================
# FACTORY FUNCTIONS (request-scoped, created per request)
# ============================================================================

def get_config_service() -> "SystemSettingService":
    """
    Get configuration service instance.

    Factory function creates new instance per request
    to ensure fresh database connection.
    """
    from app.core.config_service import ConfigService
    from app.modules.admin.service import SystemSettingService

    # Using lazy import to avoid circular dependency
    async def _get_service(db: AsyncSession) -> SystemSettingService:
        return SystemSettingService(db)

    return _get_service


def get_auth_service(
    db: AsyncSession = Depends(get_db),
    event_bus: EventBus = Depends(get_event_bus),
) -> "AuthService":
    """
    Get authentication service instance.

    Injected dependencies:
    - db: Database session (from FastAPI Depends)
    - event_bus: Event bus singleton
    """
    from app.modules.auth.service import AuthService
    return AuthService(db, event_bus)


def get_admin_service(
    db: AsyncSession = Depends(get_db),
    websocket_manager: "websocket_manager" = Depends(get_websocket_manager),
) -> "AdminService":
    """
    Get admin service instance.

    Injected dependencies:
    - db: Database session
    - websocket_manager: WebSocket manager for broadcasts
    """
    from app.modules.admin.service import AdminService
    return AdminService(db, websocket_manager)


# ============================================================================
# TYPE ALIASES (for cleaner dependency injection syntax)
# ============================================================================

# Database session
SessionDep = Annotated[AsyncSession, Depends(get_db)]

# Configuration
SettingsDep = Annotated["Settings", Depends(get_settings)]

# Event bus
EventBusDep = Annotated[EventBus, Depends(get_event_bus)]

# WebSocket manager
WebSocketManagerDep = Annotated["websocket_manager", Depends(get_websocket_manager)]

# Redis
RedisManagerDep = Annotated["redis_manager", Depends(get_redis_manager)]
