from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum

class TaskStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    ON_REVIEW = "on_review"
    COMPLETED = "completed"
    OVERDUE = "overdue"

class TaskPriority(str, enum.Enum):
    MEDIUM = "medium"
    HIGH = "high"

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Relationships
    issuer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assignee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    
    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Meta
    status: Mapped[TaskStatus] = mapped_column(String(20), default=TaskStatus.IN_PROGRESS, nullable=False, index=True)
    priority: Mapped[TaskPriority] = mapped_column(String(20), default=TaskPriority.MEDIUM, nullable=False)
    
    # Timestamps
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Report
    completion_report: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    return_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Foreign Keys
    issuer = relationship("User", foreign_keys=[issuer_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
