from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.modules.auth.router import get_current_user
from app.modules.auth.models import User
from .models import Task, TaskStatus
from .schemas import TaskCreate, TaskResponse, TaskReport, TaskReject
from app.modules.chat.websocket import manager

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("/", response_model=List[TaskResponse])
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new task.
    If unit_id is provided, creates a task for EVERY member of that unit.
    If assignee_id is provided, creates a single task.
    """
    created_tasks = []
    
    # Determine assignees
    assignee_ids = []
    if task_in.unit_id:
        # Get all users in the unit
        result = await db.execute(select(User).where(User.unit_id == task_in.unit_id))
        users = result.scalars().all()
        if not users:
            raise HTTPException(status_code=404, detail="Unit not found or empty")
        assignee_ids = [u.id for u in users if u.id != current_user.id] # Don't assign to self via unit? Maybe optional.
    elif task_in.assignee_id:
        assignee_ids = [task_in.assignee_id]
    else:
        raise HTTPException(status_code=400, detail="Either assignee_id or unit_id must be provided")

    if not assignee_ids:
         raise HTTPException(status_code=400, detail="No valid assignees found")

    for uid in assignee_ids:
        new_task = Task(
            issuer_id=current_user.id,
            assignee_id=uid,
            title=task_in.title,
            description=task_in.description,
            priority=task_in.priority,
            deadline=task_in.deadline,
            status=TaskStatus.IN_PROGRESS
        )
        db.add(new_task)
        created_tasks.append(new_task)

    await db.commit()
    
    # Refresh to get IDs and relationships
    task_ids = [t.id for t in created_tasks]
    result = await db.execute(
        select(Task)
        .where(Task.id.in_(task_ids))
        .options(
            selectinload(Task.issuer).selectinload(User.unit), 
            selectinload(Task.assignee).selectinload(User.unit)
        )
    )
    res_tasks = result.scalars().all()

    # Broadcast notifications
    for task in res_tasks:
        if task.assignee_id != current_user.id:
            await manager.broadcast_to_user(task.assignee_id, {
                "type": "new_task",
                "task_id": task.id,
                "title": task.title,
                "issuer_name": current_user.full_name or current_user.username
            })

    return res_tasks

@router.get("/received", response_model=List[TaskResponse])
async def get_received_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active tasks assigned to current user"""
    query = select(Task).where(
        Task.assignee_id == current_user.id,
        Task.status.in_([TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE, TaskStatus.ON_REVIEW])
    ).options(
        selectinload(Task.issuer).selectinload(User.unit), 
        selectinload(Task.assignee).selectinload(User.unit)
    ).order_by(Task.created_at.desc())
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    # Check for overdue
    updated = False
    now = datetime.utcnow()
    for t in tasks:
        if t.status == TaskStatus.IN_PROGRESS and t.deadline < now:
            t.status = TaskStatus.OVERDUE
            updated = True
    
    if updated:
        await db.commit()
        
    return tasks

@router.get("/issued", response_model=List[TaskResponse])
async def get_issued_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get non-completed tasks issued by current user"""
    query = select(Task).where(
        Task.issuer_id == current_user.id,
         Task.status != TaskStatus.COMPLETED
    ).options(
        selectinload(Task.issuer).selectinload(User.unit), 
        selectinload(Task.assignee).selectinload(User.unit)
    ).order_by(Task.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/completed", response_model=List[TaskResponse])
async def get_completed_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get completed tasks (either issued or received)"""
    query = select(Task).where(
        or_(Task.issuer_id == current_user.id, Task.assignee_id == current_user.id),
        Task.status == TaskStatus.COMPLETED
    ).options(
        selectinload(Task.issuer).selectinload(User.unit), 
        selectinload(Task.assignee).selectinload(User.unit)
    ).order_by(Task.completed_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{task_id}/report", response_model=TaskResponse)
async def report_task(
    task_id: int,
    report: TaskReport,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Informer submits a completion report"""
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.issuer).selectinload(User.unit), 
            selectinload(Task.assignee).selectinload(User.unit)
        )
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if task.status not in [TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE]:
         raise HTTPException(status_code=400, detail="Task cannot be reported")

    task.status = TaskStatus.ON_REVIEW
    task.completion_report = report.report_text
    await db.commit()
    await db.refresh(task)

    # Notify Issuer
    issuer_name = f"{current_user.rank} {current_user.full_name}" if current_user.rank else (current_user.full_name or current_user.username)
    await manager.broadcast_to_user(task.issuer_id, {
        "type": "task_submitted",
        "task_id": task.id,
        "title": task.title,
        "sender_name": issuer_name
    })

    return task

@router.post("/{task_id}/confirm", response_model=TaskResponse)
async def confirm_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Issuer confirms completion"""
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.issuer).selectinload(User.unit), 
            selectinload(Task.assignee).selectinload(User.unit)
        )
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.issuer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)

    # Notify Assignee that task is confirmed
    issuer_name = f"{current_user.rank} {current_user.full_name}" if current_user.rank else (current_user.full_name or current_user.username)
    await manager.broadcast_to_user(task.assignee_id, {
        "type": "task_confirmed",
        "task_id": task.id,
        "title": task.title,
        "sender_name": issuer_name
    })

    return task

@router.post("/{task_id}/reject", response_model=TaskResponse)
async def reject_task(
    task_id: int,
    rejection: TaskReject,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Issuer rejects report, sends back to work"""
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.issuer).selectinload(User.unit), 
            selectinload(Task.assignee).selectinload(User.unit)
        )
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.issuer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    task.status = TaskStatus.IN_PROGRESS if task.deadline > datetime.utcnow() else TaskStatus.OVERDUE
    task.return_reason = rejection.reason
    
    await db.commit()
    await db.refresh(task)

    # Notify Assignee
    issuer_name = f"{current_user.rank} {current_user.full_name}" if current_user.rank else (current_user.full_name or current_user.username)
    await manager.broadcast_to_user(task.assignee_id, {
        "type": "task_returned",
        "task_id": task.id,
        "title": task.title,
        "sender_name": issuer_name,
        "reason": rejection.reason
    })

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a task (Issuer only)"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    # Only issuer or admin can delete
    if task.issuer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(task)
    await db.commit()
    return None
