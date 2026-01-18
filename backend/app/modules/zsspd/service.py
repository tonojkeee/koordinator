import os
import shutil
import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from fastapi import UploadFile, HTTPException

from .models import ZsspdPackage, ZsspdFile, ZsspdStatus, ZsspdDirection
from .schemas import ZsspdPackageCreate, ZsspdPackageUpdate
from app.modules.archive.service import sanitize_filename
from app.core.file_security import safe_file_operation

logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/zsspd"

class ZsspdService:
    def __init__(self, db: AsyncSession):
        self.db = db
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    async def create_package(self, package_in: ZsspdPackageCreate, user_id: int) -> ZsspdPackage:
        db_package = ZsspdPackage(
            **package_in.model_dump(),
            created_by=user_id,
            status=ZsspdStatus.DRAFT
        )
        self.db.add(db_package)
        await self.db.commit()
        return await self.get_package(db_package.id)

    async def get_packages(self, direction: Optional[ZsspdDirection] = None, skip: int = 0, limit: int = 100, user_id: Optional[int] = None) -> List[ZsspdPackage]:
        stmt = (
            select(ZsspdPackage)
            .options(selectinload(ZsspdPackage.files), selectinload(ZsspdPackage.creator))
            .order_by(desc(ZsspdPackage.created_at))
            .offset(skip).limit(limit)
        )
        if direction:
            stmt = stmt.where(ZsspdPackage.direction == direction)
        
        if user_id:
            stmt = stmt.where(ZsspdPackage.created_by == user_id)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_package(self, package_id: int) -> Optional[ZsspdPackage]:
        stmt = select(ZsspdPackage).where(ZsspdPackage.id == package_id).options(selectinload(ZsspdPackage.files), selectinload(ZsspdPackage.creator))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_package(self, package_id: int, update_data: ZsspdPackageUpdate) -> Optional[ZsspdPackage]:
        package = await self.get_package(package_id)
        if not package:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(package, key, value)
        
        self.db.add(package)
        await self.db.commit()
        return await self.get_package(package.id)

    async def add_file(self, package_id: int, file: UploadFile) -> ZsspdFile:
        package = await self.get_package(package_id)
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        
        # Create package directory
        package_dir = os.path.join(UPLOAD_DIR, str(package_id))
        os.makedirs(package_dir, exist_ok=True)
        
        # Sanitize filename to prevent path traversal
        safe_filename = sanitize_filename(file.filename or 'unnamed')
        file_path = os.path.join(package_dir, safe_filename)
        
        # Verify path is within package directory (additional safety check)
        package_dir_abs = os.path.abspath(package_dir)
        file_path_abs = os.path.abspath(file_path)
        if not file_path_abs.startswith(package_dir_abs + os.sep):
            logger.error(f"Path traversal attempt detected: {file.filename}")
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(file_path)
        
        db_file = ZsspdFile(
            package_id=package.id,
            filename=file.filename,
            file_path=file_path,
            file_size=file_size
        )
        self.db.add(db_file)
        await self.db.commit()
        await self.db.refresh(db_file)
        return db_file
    
    async def delete_file(self, file_id: int) -> bool:
        db_file = await self.db.get(ZsspdFile, file_id)
        if not db_file:
            return False
            
        # Try to delete physical file with safe path validation
        try:
            safe_path = safe_file_operation(db_file.file_path, UPLOAD_DIR)
            if os.path.exists(safe_path):
                os.remove(safe_path)
        except ValueError as e:
            logger.error(f"Path traversal detected in delete_file: {e}")
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
                
        await self.db.delete(db_file)
        await self.db.commit()
        return True
