from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.modules.auth.schemas import UserResponse

class OverviewStats(BaseModel):
    total_users: int
    online_users: int
    messages_today: int
    total_files: int
    total_storage_size: int
    tasks_total: int
    tasks_completed: int
    tasks_in_progress: int
    tasks_on_review: int
    tasks_overdue: int

class ActivityStat(BaseModel):
    date: str
    messages: int
    new_users: int
    new_tasks: int

class StorageStat(BaseModel):
    name: str
    value: int
    count: int
    color: str

class UnitStat(BaseModel):
    name: str
    value: int

class TaskUnitStat(BaseModel):
    name: str
    total: int
    completed: int

class TopUserStat(BaseModel):
    user: UserResponse
    count: int

class ActivityLogEvent(BaseModel):
    id: str
    type: str
    user: str
    description: str
    timestamp: datetime


class AuditLogResponse(BaseModel):
    id: int
    user: UserResponse
    action: str
    target_type: str
    target_id: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class SystemHealth(BaseModel):
    uptime: str
    cpu_load: float
    ram_usage: float
    status: str


class SystemSettingUpdate(BaseModel):
    value: str | int | bool


class SystemSettingResponse(BaseModel):
    key: str
    value: str
    type: str
    description: Optional[str] = None
    is_public: bool
    group: str

    class Config:
        from_attributes = True


class DatabaseConfig(BaseModel):
    type: str  # sqlite | mysql
    host: Optional[str] = None
    port: Optional[int] = 3306
    user: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
