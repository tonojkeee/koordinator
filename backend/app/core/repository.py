"""
Base repository class to eliminate CRUD duplication.
Provides generic database operations for all models.
"""
from typing import Generic, TypeVar, Type, Optional, List, Any
from sqlalchemy import select, update, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from sqlalchemy.orm import DeclarativeBase

ModelType = TypeVar("ModelType", bound=DeclarativeBase)
CreateSchemaType = TypeVar("CreateSchemaType", bound=Any)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=Any)


class BaseRepository(Generic[ModelType]):
    """Generic repository with common CRUD operations."""
    
    def __init__(self, model: Type[ModelType]):
        self.model = model
        self.model_name = model.__name__
    
    async def get_by_id(
        self,
        db: AsyncSession,
        id: int
    ) -> Optional[ModelType]:
        """Get a single record by ID."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()
    
    async def get_all(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get all records with pagination."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def create(
        self,
        db: AsyncSession,
        obj_data: CreateSchemaType
    ) -> ModelType:
        """Create a new record."""
        db_obj = self.model(**obj_data.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self,
        db: AsyncSession,
        id: int,
        obj_data: UpdateSchemaType
    ) -> Optional[ModelType]:
        """Update an existing record."""
        db_obj = await self.get_by_id(db, id)
        if not db_obj:
            return None
        
        update_data = obj_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def delete(
        self,
        db: AsyncSession,
        id: int
    ) -> bool:
        """Delete a record by ID."""
        db_obj = await self.get_by_id(db, id)
        if not db_obj:
            return False
        
        await db.delete(db_obj)
        await db.commit()
        return True
    
    async def exists(
        self,
        db: AsyncSession,
        id: int
    ) -> bool:
        """Check if a record exists."""
        return await self.get_by_id(db, id) is not None
    
    async def count(
        self,
        db: AsyncSession
    ) -> int:
        """Count all records."""
        result = await db.execute(select(self.model.id))
        return result.scalar()
