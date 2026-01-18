import os
import re
import shutil
import unicodedata
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from app.modules.archive.models import ArchiveFile, ArchiveFolder
from app.core.file_security import safe_file_operation

logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/archive"

# Reserved filenames on Windows
RESERVED_NAMES = {'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                  'LPT1', 'LPT2', 'LPT3', 'LPT4'}


def sanitize_filename(filename: str) -> str:
    """
    Comprehensive filename sanitization to prevent path traversal and filesystem issues.
    
    Args:
        filename: The filename to sanitize
        
    Returns:
        Sanitized filename safe for filesystem operations
    """
    if not filename:
        return 'unnamed'
    
    # 1. Unicode normalization (prevent homograph attacks)
    filename = unicodedata.normalize('NFKD', filename)
    
    # 2. Remove path separators and dangerous characters
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)
    
    # 3. Remove ALL occurrences of .. (not just replace once)
    while '..' in sanitized:
        sanitized = sanitized.replace('..', '')
    
    # 4. Remove leading/trailing dots, spaces, and underscores
    sanitized = sanitized.strip('. _')
    
    # 5. Check for reserved names (Windows)
    name_without_ext = os.path.splitext(sanitized)[0].upper()
    if name_without_ext in RESERVED_NAMES:
        sanitized = f"file_{sanitized}"
    
    # 6. Limit length to prevent filesystem issues
    if len(sanitized) > 200:
        name, ext = os.path.splitext(sanitized)
        sanitized = name[:200-len(ext)] + ext
    
    # 7. Ensure we have a valid filename
    if not sanitized or sanitized == '.':
        return 'unnamed'
    
    return sanitized

class ArchiveService:
    @staticmethod
    async def create_folder(
        db: AsyncSession,
        name: str,
        unit_id: int,
        owner_id: int,
        parent_id: Optional[int] = None,
        is_private: bool = False
    ) -> ArchiveFolder:
        db_folder = ArchiveFolder(
            name=name,
            unit_id=unit_id,
            owner_id=owner_id,
            parent_id=parent_id,
            is_private=is_private
        )
        db.add(db_folder)
        await db.commit()
        await db.refresh(db_folder)
        return db_folder

    @staticmethod
    async def get_folder_contents(
        db: AsyncSession,
        unit_id: Optional[int] = None,
        parent_id: Optional[int] = None,
        is_private: bool = False
    ) -> Dict[str, Any]:
        """Get contents of a folder. If parent_id is None and unit_id is provided, get root of that unit."""
        # Get folders
        folder_stmt = (
            select(ArchiveFolder)
            .where(and_(
                ArchiveFolder.unit_id == unit_id,
                ArchiveFolder.parent_id == parent_id,
                ArchiveFolder.is_private == is_private
            ))
            .options(joinedload(ArchiveFolder.owner))
            .order_by(ArchiveFolder.name.asc())
        )
        folder_result = await db.execute(folder_stmt)
        folders = folder_result.scalars().all()

        # Get files
        file_stmt = (
            select(ArchiveFile)
            .where(and_(
                ArchiveFile.unit_id == unit_id,
                ArchiveFile.folder_id == parent_id,
                ArchiveFile.is_private == is_private
            ))
            .options(joinedload(ArchiveFile.owner), joinedload(ArchiveFile.unit))
            .order_by(ArchiveFile.created_at.desc())
        )
        file_result = await db.execute(file_stmt)
        files = file_result.scalars().all()

        # Add names to response objects manually if needed, 
        # but pydantic schemas will handle it if relationship names match
        for f in folders:
            f.owner_name = f.owner.full_name if f.owner else "System"
        
        for f in files:
            f.owner_name = f.owner.full_name if f.owner else "System"
            f.unit_name = f.unit.name if f.unit else "Unknown"

        return {
            "folders": folders,
            "files": files
        }

    @staticmethod
    async def save_file(
        db: AsyncSession, 
        file: UploadFile, 
        title: str, 
        description: Optional[str],
        owner_id: int,
        unit_id: int,
        folder_id: Optional[int] = None,
        is_private: bool = False
    ) -> ArchiveFile:
        # Create directory if it doesn't exist
        unit_dir = os.path.join(UPLOAD_DIR, str(unit_id))
        os.makedirs(unit_dir, exist_ok=True)
        
        # Save file to disk with sanitized filename
        safe_filename = f"{datetime.now().timestamp()}_{sanitize_filename(file.filename or 'unnamed')}"
        file_path = os.path.join(unit_dir, safe_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Create DB record
        db_file = ArchiveFile(
            title=title,
            description=description,
            file_path=f"/{file_path}",
            file_size=file.size,
            mime_type=file.content_type,
            owner_id=owner_id,
            unit_id=unit_id,
            folder_id=folder_id,
            is_private=is_private
        )
        
        db.add(db_file)
        await db.commit()
        await db.refresh(db_file)
        return db_file

    @staticmethod
    async def get_file_by_id(db: AsyncSession, file_id: int) -> Optional[ArchiveFile]:
        stmt = (
            select(ArchiveFile)
            .where(ArchiveFile.id == file_id)
            .options(joinedload(ArchiveFile.unit))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_folder_by_id(db: AsyncSession, folder_id: int) -> Optional[ArchiveFolder]:
        stmt = select(ArchiveFolder).where(ArchiveFolder.id == folder_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_file(db: AsyncSession, file_id: int) -> bool:
        file_record = await ArchiveService.get_file_by_id(db, file_id)
        if not file_record:
            return False
            
        # Delete from disk with safe path validation
        try:
            safe_path = safe_file_operation(file_record.file_path, UPLOAD_DIR)
            if os.path.exists(safe_path):
                os.remove(safe_path)
        except ValueError as e:
            logger.error(f"Path traversal detected in delete_file: {e}")
            # Continue with DB deletion even if file deletion fails
        except Exception as e:
            logger.error(f"Error deleting file from disk: {e}")
            
        # Delete from DB
        await db.delete(file_record)
        await db.commit()
        return True

    @staticmethod
    async def delete_folder(db: AsyncSession, folder_id: int) -> bool:
        folder = await ArchiveService.get_folder_by_id(db, folder_id)
        if not folder:
            return False

        # Recursive delete subfolders and files
        stmt_files = select(ArchiveFile).where(ArchiveFile.folder_id == folder_id)
        res_files = await db.execute(stmt_files)
        files = res_files.scalars().all()
        for f in files:
            await ArchiveService.delete_file(db, f.id)

        stmt_folders = select(ArchiveFolder).where(ArchiveFolder.parent_id == folder_id)
        res_folders = await db.execute(stmt_folders)
        subfolders = res_folders.scalars().all()
        for sub in subfolders:
            await ArchiveService.delete_folder(db, sub.id)

        await db.delete(folder)
        await db.commit()
        return True

    @staticmethod
    async def update_folder(db: AsyncSession, folder_id: int, folder_data: dict) -> Optional[ArchiveFolder]:
        folder = await ArchiveService.get_folder_by_id(db, folder_id)
        if not folder:
            return None
            
        for key, value in folder_data.items():
            if hasattr(folder, key):
                setattr(folder, key, value)
                
        await db.commit()
        await db.refresh(folder)
        return folder

    @staticmethod
    async def update_file(db: AsyncSession, file_id: int, file_data: dict) -> Optional[ArchiveFile]:
        file_record = await ArchiveService.get_file_by_id(db, file_id)
        if not file_record:
            return None
            
        for key, value in file_data.items():
            if hasattr(file_record, key):
                setattr(file_record, key, value)
                
        await db.commit()
        await db.refresh(file_record)
        return file_record

    @staticmethod
    async def update_file_content(
        db: AsyncSession,
        file_id: int,
        file: UploadFile
    ) -> Optional[ArchiveFile]:
        file_record = await ArchiveService.get_file_by_id(db, file_id)
        if not file_record:
            return None
            
        # Delete old file from disk with safe path validation
        try:
            old_path = safe_file_operation(file_record.file_path, UPLOAD_DIR)
            if os.path.exists(old_path):
                os.remove(old_path)
        except ValueError as e:
            logger.error(f"Path traversal detected in update_file_content: {e}")
        except Exception as e:
            logger.error(f"Error deleting old file: {e}")
            
        # Save new file to disk
        unit_dir = os.path.join(UPLOAD_DIR, str(file_record.unit_id))
        os.makedirs(unit_dir, exist_ok=True)
        
        # Sanitize filename
        sanitized = sanitize_filename(file.filename or 'unnamed')
        safe_filename = f"{datetime.now().timestamp()}_{sanitized}"
        new_path = os.path.join(unit_dir, safe_filename)
        
        with open(new_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Update DB record
        file_record.file_path = f"/{new_path}"
        file_record.file_size = file.size
        # Update title if it changed (usually same)
        file_record.created_at = datetime.now() # Update "last modified" time if needed, though strictly it's "created_at" in our model
        
        await db.commit()
        await db.refresh(file_record)
        return file_record
    @staticmethod
    async def move_items(
        db: AsyncSession,
        item_ids: List[int],
        item_types: List[str],
        target_folder_id: Optional[int],
        target_unit_id: int,
        is_private: bool
    ) -> bool:
        # Batch load all files and folders to avoid N+1 queries
        file_ids = [item_id for item_id, item_type in zip(item_ids, item_types) if item_type == 'file']
        folder_ids = [item_id for item_id, item_type in zip(item_ids, item_types) if item_type == 'folder']
        
        # Load all files at once
        files_dict = {}
        if file_ids:
            stmt = select(ArchiveFile).where(ArchiveFile.id.in_(file_ids))
            res = await db.execute(stmt)
            files_dict = {f.id: f for f in res.scalars().all()}
        
        # Load all folders at once
        folders_dict = {}
        if folder_ids:
            stmt = select(ArchiveFolder).where(ArchiveFolder.id.in_(folder_ids))
            res = await db.execute(stmt)
            folders_dict = {f.id: f for f in res.scalars().all()}
        
        # Update items
        for item_id, item_type in zip(item_ids, item_types):
            if item_type == 'file':
                file = files_dict.get(item_id)
                if file:
                    file.folder_id = target_folder_id
                    file.unit_id = target_unit_id
                    file.is_private = is_private
            else:
                folder = folders_dict.get(item_id)
                if folder:
                    folder.parent_id = target_folder_id
                    folder.unit_id = target_unit_id
                    folder.is_private = is_private
                    # Recursively update all children unit_id and is_private
                    await ArchiveService._update_folder_children_context(db, item_id, target_unit_id, is_private)
        
        await db.commit()
        return True

    @staticmethod
    async def _update_folder_children_context(db: AsyncSession, folder_id: int, unit_id: int, is_private: bool):
        # Update files in this folder
        from sqlalchemy import update
        await db.execute(
            update(ArchiveFile)
            .where(ArchiveFile.folder_id == folder_id)
            .values(unit_id=unit_id, is_private=is_private)
        )
        
        # Get subfolders
        stmt = select(ArchiveFolder).where(ArchiveFolder.parent_id == folder_id)
        res = await db.execute(stmt)
        subfolders = res.scalars().all()
        for sub in subfolders:
            sub.unit_id = unit_id
            sub.is_private = is_private
            await ArchiveService._update_folder_children_context(db, sub.id, unit_id, is_private)

    @staticmethod
    async def copy_items(
        db: AsyncSession,
        item_ids: List[int],
        item_types: List[str],
        target_folder_id: Optional[int],
        target_unit_id: int,
        is_private: bool,
        owner_id: int
    ) -> bool:
        # Batch load all files and folders to avoid N+1 queries
        file_ids = [item_id for item_id, item_type in zip(item_ids, item_types) if item_type == 'file']
        folder_ids = [item_id for item_id, item_type in zip(item_ids, item_types) if item_type == 'folder']
        
        # Load all files at once
        files_dict = {}
        if file_ids:
            stmt = select(ArchiveFile).where(ArchiveFile.id.in_(file_ids))
            res = await db.execute(stmt)
            files_dict = {f.id: f for f in res.scalars().all()}
        
        # Load all folders at once
        folders_dict = {}
        if folder_ids:
            stmt = select(ArchiveFolder).where(ArchiveFolder.id.in_(folder_ids))
            res = await db.execute(stmt)
            folders_dict = {f.id: f for f in res.scalars().all()}
        
        # Copy items
        for item_id, item_type in zip(item_ids, item_types):
            if item_type == 'file':
                file = files_dict.get(item_id)
                if file:
                    # Copy file on disk with safe path validation
                    try:
                        old_path = safe_file_operation(file.file_path, UPLOAD_DIR)
                        unit_dir = os.path.join(UPLOAD_DIR, str(target_unit_id))
                        os.makedirs(unit_dir, exist_ok=True)
                        
                        # Sanitize filename and ensure total length is within limits
                        timestamp = datetime.now().timestamp()
                        sanitized = sanitize_filename(os.path.basename(file.file_path))
                        max_name_length = 255 - len(str(timestamp)) - 1
                        if len(sanitized) > max_name_length:
                            name, ext = os.path.splitext(sanitized)
                            sanitized = name[:max_name_length - len(ext)] + ext
                        
                        new_filename = f"{timestamp}_{sanitized}"
                        new_path = os.path.join(unit_dir, new_filename)
                        
                        if os.path.exists(old_path):
                            shutil.copy2(old_path, new_path)
                        else:
                            logger.warning(f"Source file not found: {old_path}")
                            continue
                    except ValueError as e:
                        logger.error(f"Path traversal detected in copy operation: {e}")
                        continue
                    except Exception as e:
                        logger.error(f"Error copying file: {e}")
                        continue
                    
                    new_file = ArchiveFile(
                        title=file.title,
                        description=file.description,
                        file_path=f"/{new_path}",
                        file_size=file.file_size,
                        mime_type=file.mime_type,
                        owner_id=owner_id,
                        unit_id=target_unit_id,
                        folder_id=target_folder_id,
                        is_private=is_private
                    )
                    db.add(new_file)
            else:
                await ArchiveService._copy_folder_recursive(db, item_id, target_folder_id, target_unit_id, is_private, owner_id)
        
        await db.commit()
        return True

    @staticmethod
    async def _copy_folder_recursive(db: AsyncSession, folder_id: int, target_parent_id: Optional[int], target_unit_id: int, is_private: bool, owner_id: int):
        stmt = select(ArchiveFolder).where(ArchiveFolder.id == folder_id)
        res = await db.execute(stmt)
        folder = res.scalar_one_or_none()
        if not folder: return

        # Create new folder
        new_folder = ArchiveFolder(
            name=folder.name,
            unit_id=target_unit_id,
            owner_id=owner_id,
            parent_id=target_parent_id,
            is_private=is_private
        )
        db.add(new_folder)
        await db.flush() # Get new_folder.id

        # Copy files
        stmt_files = select(ArchiveFile).where(ArchiveFile.folder_id == folder_id)
        res_files = await db.execute(stmt_files)
        files = res_files.scalars().all()
        for f in files:
            try:
                old_path = safe_file_operation(f.file_path, UPLOAD_DIR)
                unit_dir = os.path.join(UPLOAD_DIR, str(target_unit_id))
                os.makedirs(unit_dir, exist_ok=True)
                
                # Sanitize filename and ensure total length is within limits
                timestamp = datetime.now().timestamp()
                sanitized = sanitize_filename(os.path.basename(f.file_path))
                max_name_length = 255 - len(str(timestamp)) - 1
                if len(sanitized) > max_name_length:
                    name, ext = os.path.splitext(sanitized)
                    sanitized = name[:max_name_length - len(ext)] + ext
                
                new_filename = f"{timestamp}_{sanitized}"
                new_path = os.path.join(unit_dir, new_filename)
                
                if os.path.exists(old_path):
                    shutil.copy2(old_path, new_path)
                else:
                    logger.warning(f"Source file not found: {old_path}")
                    continue
            except ValueError as e:
                logger.error(f"Path traversal detected in folder copy: {e}")
                continue
            except Exception as e:
                logger.error(f"Error copying file in folder: {e}")
                continue
            
            new_file = ArchiveFile(
                title=f.title,
                description=f.description,
                file_path=f"/{new_path}",
                file_size=f.file_size,
                mime_type=f.mime_type,
                owner_id=owner_id,
                unit_id=target_unit_id,
                folder_id=new_folder.id,
                is_private=is_private
            )
            db.add(new_file)

        # Copy subfolders
        stmt_folders = select(ArchiveFolder).where(ArchiveFolder.parent_id == folder_id)
        res_folders = await db.execute(stmt_folders)
        subfolders = res_folders.scalars().all()
        for sub in subfolders:
            await ArchiveService._copy_folder_recursive(db, sub.id, new_folder.id, target_unit_id, is_private, owner_id)
