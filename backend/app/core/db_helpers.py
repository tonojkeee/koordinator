"""
Database helper utilities for common query patterns.

This module provides reusable functions for common database operations
to reduce code duplication and improve consistency across routers.
"""

from typing import Type, TypeVar, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.core.database import Base


T = TypeVar('T', bound=Base)


def get_or_404(
    db: Session,
    model: Type[T],
    entity_id: int,
    error_message: str = "Entity not found"
) -> T:
    """
    Get entity by ID or raise 404 HTTPException.
    
    Args:
        db: Database session
        model: SQLAlchemy model class
        entity_id: ID of the entity to retrieve
        error_message: Custom error message for 404 response
        
    Returns:
        The entity instance
        
    Raises:
        HTTPException: 404 if entity not found
        
    Example:
        document = get_or_404(db, Document, document_id, "Document not found")
    """
    entity = db.query(model).filter(model.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail=error_message)
    return entity


def check_ownership(
    entity: Base,
    user_id: int,
    owner_field: str = 'owner_id',
    error_message: str = "Not authorized"
) -> None:
    """
    Check if user owns the entity, raise 403 if not.
    
    Args:
        entity: The entity to check ownership for
        user_id: ID of the user to check
        owner_field: Name of the owner field on the entity (default: 'owner_id')
        error_message: Custom error message for 403 response
        
    Raises:
        HTTPException: 403 if user doesn't own the entity
        
    Example:
        check_ownership(document, current_user.id)
        check_ownership(task, current_user.id, 'creator_id')
    """
    if not hasattr(entity, owner_field):
        raise ValueError(f"Entity does not have field '{owner_field}'")
    
    if getattr(entity, owner_field) != user_id:
        raise HTTPException(status_code=403, detail=error_message)


def check_access(
    db: Session,
    entity: Base,
    user_id: int,
    owner_field: str = 'owner_id',
    share_model: Optional[Type[Base]] = None,
    entity_id_field: Optional[str] = None,
    user_id_field: str = 'user_id',
    error_message: str = "Not authorized"
) -> None:
    """
    Check if user has access to entity (as owner or via sharing).
    
    Args:
        db: Database session
        entity: The entity to check access for
        user_id: ID of the user to check
        owner_field: Name of the owner field on the entity (default: 'owner_id')
        share_model: Model class for share table (optional)
        entity_id_field: Name of the entity ID field in share table
        user_id_field: Name of the user ID field in share table (default: 'user_id')
        error_message: Custom error message for 403 response
        
    Raises:
        HTTPException: 403 if user doesn't have access
        
    Example:
        check_access(
            db, document, current_user.id,
            share_model=DocumentShare,
            entity_id_field='document_id'
        )
    """
    # Check if user is owner
    if hasattr(entity, owner_field) and getattr(entity, owner_field) == user_id:
        return
    
    # Check if entity is shared with user
    if share_model and entity_id_field:
        share = db.query(share_model).filter(
            getattr(share_model, entity_id_field) == entity.id,
            getattr(share_model, user_id_field) == user_id
        ).first()
        if share:
            return
    
    # No access
    raise HTTPException(status_code=403, detail=error_message)


def check_task_permission(
    task: Base,
    user_id: int,
    error_message: str = "Not authorized"
) -> None:
    """
    Check if user has permission to access a task (as assignee or creator).
    
    Args:
        task: The task entity to check
        user_id: ID of the user to check
        error_message: Custom error message for 403 response
        
    Raises:
        HTTPException: 403 if user doesn't have permission
        
    Example:
        check_task_permission(task, current_user.id)
    """
    if task.assignee_id != user_id and task.creator_id != user_id:
        raise HTTPException(status_code=403, detail=error_message)
