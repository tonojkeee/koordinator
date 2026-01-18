from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.modules.auth.router import get_admin_user, get_current_user
from app.modules.auth.schemas import UserResponse
from app.modules.auth.models import User
from app.modules.admin.service import AdminService, SystemSettingService
from app.modules.admin.schemas import (
    OverviewStats, ActivityStat, StorageStat, 
    UnitStat, TopUserStat, ActivityLogEvent, AuditLogResponse,
    SystemHealth, TaskUnitStat, SystemSettingResponse, SystemSettingUpdate
)
from app.modules.tasks.schemas import TaskResponse

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/stats/overview", response_model=OverviewStats)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get high-level dashboard stats"""
    return await AdminService.get_overview_stats(db)

@router.get("/stats/activity", response_model=List[ActivityStat])
async def get_activity(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get activity charts data"""
    return await AdminService.get_activity_stats(db, days)

@router.get("/stats/storage", response_model=List[StorageStat])
async def get_storage(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get storage usage breakdown"""
    return await AdminService.get_storage_stats(db)
@router.get("/active-sessions", response_model=List[UserResponse])
async def get_active_sessions(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get list of currently active users"""
    return await AdminService.get_active_sessions(db)

@router.get("/stats/units", response_model=List[UnitStat])
async def get_unit_stats(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get unit distribution stats"""
    return await AdminService.get_unit_distribution(db)

@router.get("/stats/top-users", response_model=List[TopUserStat])
async def get_top_users(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get most active users"""
    return await AdminService.get_top_active_users(db)

@router.get("/activity", response_model=List[ActivityLogEvent])
async def get_recent_activity(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get recent system events feed"""
    return await AdminService.get_recent_activity(db)

@router.get("/logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get detailed system audit logs"""
    return await AdminService.get_audit_logs(db, limit)

@router.get("/stats/health", response_model=SystemHealth)
async def get_system_health(
    request: Request,
    _ = Depends(get_admin_user)
):
    """Get real-time system performance metrics"""
    return await AdminService.get_system_health(request.app.state)

@router.get("/stats/tasks/units", response_model=List[TaskUnitStat])
async def get_task_unit_stats(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get unit task distribution stats"""
    return await AdminService.get_task_unit_stats(db)

@router.get("/tasks", response_model=List[TaskResponse])
async def get_all_tasks(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get all tasks for administration"""
    return await AdminService.get_all_tasks(db)


@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_admin_user)
):
    """Get all system settings"""
    return await SystemSettingService.get_all_settings(db)


@router.get("/public-settings")
async def get_public_settings(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_user)
):
    """Get public system settings for all users"""
    return await SystemSettingService.get_public_settings(db)


@router.patch("/settings/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    setting_data: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Update a system setting"""
    return await SystemSettingService.set_value(db, key, setting_data.value, admin.id)


# Database Configuration Endpoints
from app.modules.admin.schemas import DatabaseConfig
from app.modules.admin.utils import read_env_file, write_env_file, parse_database_url
from sqlalchemy import create_engine, text

@router.get("/database/config", response_model=DatabaseConfig)
async def get_database_config(
    _ = Depends(get_admin_user)
):
    """Get current database configuration from .env"""
    env_vars = read_env_file()
    db_url = env_vars.get("DATABASE_URL", "")
    return parse_database_url(db_url)

@router.post("/database/test")
async def test_database_connection(
    config: DatabaseConfig,
    _ = Depends(get_admin_user)
):
    """Test database connection with provided config"""
    # Construct URL
    if config.type == "sqlite":
        # For testing purposes, we use a memory DB or the default file
        # But for saving we want to persist the file path
        url = "sqlite:///./backend/teamchat.db" # Default path
    elif config.type == "mysql":
        if not all([config.host, config.user, config.database]):
             raise HTTPException(status_code=400, detail="Missing required fields for MySQL")
        
        password = config.password if config.password else ""
        url = f"mysql+pymysql://{config.user}:{password}@{config.host}:{config.port}/{config.database}"
    else:
        raise HTTPException(status_code=400, detail="Unsupported database type")

    try:
        # Use sync engine for quick test
        # We need to install pymysql if not present, but for now we assume it is or will be
        # user must have installed it. 
        # Create engine and connect
        engine_test = create_engine(url)
        with engine_test.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        from app.core.errors import sanitize_database_error
        error_msg = sanitize_database_error(e, "database connection test")
        raise HTTPException(status_code=400, detail=error_msg)

@router.post("/database/save")
async def save_database_config(
    config: DatabaseConfig,
    _ = Depends(get_admin_user)
):
    """Save database configuration to .env and request restart"""
    
    # Construct async URL for app usage
    if config.type == "sqlite":
        url = "sqlite+aiosqlite:///./backend/teamchat.db"
    elif config.type == "mysql":
        if not all([config.host, config.user, config.database]):
             raise HTTPException(status_code=400, detail="Missing required fields for MySQL")
        
        password = config.password if config.password else ""
        url = f"mysql+aiomysql://{config.user}:{password}@{config.host}:{config.port}/{config.database}"
    else:
         raise HTTPException(status_code=400, detail="Unsupported database type")
         
    # 1. Test connection first (using async driver version if possible, or just re-use sync logic)
    # We re-use logic but with sync driver to be sure credentials function
    test_url = url.replace("+aiosqlite", "").replace("+aiomysql", "+pymysql")
    try:
        engine_test = create_engine(test_url)
        with engine_test.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        from app.core.errors import sanitize_database_error
        error_msg = sanitize_database_error(e, "database configuration validation")
        raise HTTPException(status_code=400, detail=error_msg)

    # 2. Write to .env
    try:
        write_env_file({"DATABASE_URL": url})
    except Exception as e:
        from app.core.errors import sanitize_file_error
        error_msg = sanitize_file_error(e, "configuration file write")
        raise HTTPException(status_code=500, detail=error_msg)
         
    return {"status": "success", "message": "Configuration saved. Restart required."}
