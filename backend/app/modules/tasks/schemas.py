from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.modules.auth.schemas import UserResponse
from .models import TaskStatus, TaskPriority

class TaskBase(BaseModel):
    title: str
    description: str
    priority: TaskPriority = TaskPriority.MEDIUM
    deadline: datetime

class TaskCreate(TaskBase):
    assignee_id: Optional[int] = None
    unit_id: Optional[int] = None # Helper to assign to all unit members

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Подготовить отчет",
                "description": "Сделать годовой отчет по связи",
                "priority": "high",
                "deadline": "2024-12-31T23:59:59",
                "assignee_id": 1
            }
        }

class TaskReport(BaseModel):
    report_text: str

class TaskReject(BaseModel):
    reason: str

class TaskResponse(TaskBase):
    id: int
    status: TaskStatus
    issuer_id: int
    assignee_id: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completion_report: Optional[str] = None
    return_reason: Optional[str] = None
    
    # Included details
    issuer: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class TaskList(BaseModel):
    items: List[TaskResponse]
    total: int
