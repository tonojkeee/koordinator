import os
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.modules.auth.router import get_current_user
from app.modules.auth.models import User
from app.modules.archive.service import ArchiveService
from app.core.config_service import ConfigService
from app.modules.admin.service import SystemSettingService
from app.modules.archive.schemas import (
    ArchiveFileResponse, 
    ArchiveFolderResponse, 
    ArchiveFolderCreate,
    ArchiveFolderUpdate,
    ArchiveFileUpdate,
    ArchiveContentResponse,
    ArchiveBatchAction
)
from app.core.file_security import secure_file_response, safe_file_operation

router = APIRouter(prefix="/archive", tags=["archive"])

@router.get("/contents", response_model=ArchiveContentResponse)
async def get_archive_contents(
    parent_id: Optional[int] = Query(None),
    unit_id: Optional[int] = Query(None),
    is_private: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get contents of a folder (folders and files). Defaults to current user's unit if unit_id not specified."""
    target_unit_id = unit_id if unit_id is not None else current_user.unit_id
    
    # If we are inside a folder, the unit_id should be inherited from the folder
    if parent_id:
        folder = await ArchiveService.get_folder_by_id(db, parent_id)
        if folder:
            target_unit_id = folder.unit_id

    return await ArchiveService.get_folder_contents(
        db, 
        unit_id=target_unit_id, 
        parent_id=parent_id,
        is_private=is_private
    )

@router.post("/folders", response_model=ArchiveFolderResponse)
async def create_folder(
    folder_data: ArchiveFolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new folder"""
    target_unit_id = folder_data.unit_id if folder_data.unit_id else current_user.unit_id
    
    # Optional: restriction - only admins can create folders in other units (for public)
    if not folder_data.is_private and current_user.role != 'admin' and target_unit_id != current_user.unit_id:
        raise HTTPException(status_code=403, detail="You can only create folders in your own unit")

    return await ArchiveService.create_folder(
        db,
        name=folder_data.name,
        unit_id=target_unit_id,
        owner_id=current_user.id,
        parent_id=folder_data.parent_id,
        is_private=folder_data.is_private
    )

@router.post("/upload", response_model=ArchiveFileResponse)
async def upload_file(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    folder_id: Optional[int] = Form(None),
    unit_id: Optional[int] = Form(None),
    is_private: bool = Form(False),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a file, optionally into a folder"""
    target_unit_id = unit_id if unit_id else current_user.unit_id
    
    if not is_private and current_user.role != 'admin' and target_unit_id != current_user.unit_id:
        raise HTTPException(status_code=403, detail="You can only upload files to your own unit")

    # Validate File Type
    extension = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    allowed_types_str = await ConfigService.get_value(db, "allowed_file_types")
    if allowed_types_str:
        allowed = {t.strip().lower() for t in allowed_types_str.split(",")}
        if extension not in allowed:
            raise HTTPException(status_code=400, detail=f"File type {extension} not allowed")

    # Validate Size (approximate using content-length)
    max_mb_str = await ConfigService.get_value(db, "max_upload_size_mb")
    try:
        max_bytes = int(max_mb_str) * 1024 * 1024
    except (ValueError, TypeError):
        max_bytes = 50 * 1024 * 1024
        
    if file.size and file.size > max_bytes:
         raise HTTPException(status_code=413, detail=f"File too large (max {max_mb_str}MB)")

    return await ArchiveService.save_file(
        db,
        file=file,
        title=title,
        description=description,
        owner_id=current_user.id,
        unit_id=target_unit_id,
        folder_id=folder_id,
        is_private=is_private
    )

@router.get("/files/{file_id}/view")
async def view_file(
    file_id: int,
    download: Optional[int] = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """View or download a file with access control"""
    file_record = await ArchiveService.get_file_by_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Access control: All authenticated users can view, but only owners/admins can delete (handled in delete_file)
    
    # Secure path validation
    try:
        safe_path = safe_file_operation(file_record.file_path, "uploads/archive")
    except ValueError as e:
        raise HTTPException(status_code=403, detail="Invalid file path")
    
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File content not found on disk")
    
    content_disposition = "attachment" if download else "inline"
    return secure_file_response(
        safe_path, 
        media_type=file_record.mime_type,
        filename=os.path.basename(file_record.file_path) if download else None,
        content_disposition=content_disposition
    )

@router.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a file with unit-based permissions:
    - Global (is_private=False): Only users from the same unit can delete
    - Private (is_private=True): All unit members can delete
    - Admin can always delete
    """
    file_record = await ArchiveService.get_file_by_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Admin can always delete
    if current_user.role == 'admin':
        await ArchiveService.delete_file(db, file_id)
        return {"status": "success"}
    
    # Owner can always delete their own files
    if file_record.owner_id == current_user.id:
        await ArchiveService.delete_file(db, file_id)
        return {"status": "success"}
    
    # Check unit-based permissions
    if current_user.unit_id != file_record.unit_id:
        raise HTTPException(status_code=403, detail="Вы можете удалять только файлы своего подразделения")
    
    await ArchiveService.delete_file(db, file_id)
    return {"status": "success"}

@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a folder with unit-based permissions"""
    folder = await ArchiveService.get_folder_by_id(db, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Admin can always delete
    if current_user.role == 'admin':
        await ArchiveService.delete_folder(db, folder_id)
        return {"status": "success"}
    
    # Owner can always delete their own folders
    if folder.owner_id == current_user.id:
        await ArchiveService.delete_folder(db, folder_id)
        return {"status": "success"}
    
    # Check unit-based permissions
    if current_user.unit_id != folder.unit_id:
        raise HTTPException(status_code=403, detail="Вы можете удалять только папки своего подразделения")
    
    await ArchiveService.delete_folder(db, folder_id)
    return {"status": "success"}

@router.patch("/folders/{folder_id}", response_model=ArchiveFolderResponse)
async def update_folder(
    folder_id: int,
    folder_data: ArchiveFolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update folder properties (e.g. rename)"""
    folder = await ArchiveService.get_folder_by_id(db, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    if current_user.role != 'admin' and folder.owner_id != current_user.id and folder.unit_id != current_user.unit_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Convert to dict, excluding unset fields
    update_dict = folder_data.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    return await ArchiveService.update_folder(db, folder_id, update_dict)

@router.patch("/files/{file_id}", response_model=ArchiveFileResponse)
async def update_file(
    file_id: int,
    file_data: ArchiveFileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update file properties (e.g. rename)"""
    file_record = await ArchiveService.get_file_by_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    if current_user.role != 'admin' and file_record.owner_id != current_user.id and file_record.unit_id != current_user.unit_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Convert to dict, excluding unset fields
    update_dict = file_data.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    return await ArchiveService.update_file(db, file_id, update_dict)

@router.post("/files/update-content", response_model=ArchiveFileResponse)
async def update_file_content(
    file_id: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update file content (Sync back after local edit)"""
    file_record = await ArchiveService.get_file_by_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Permission check: admin OR owner OR same unit member
    if current_user.role != 'admin' and file_record.owner_id != current_user.id and file_record.unit_id != current_user.unit_id:
        raise HTTPException(status_code=403, detail="Вы не можете изменять этот файл")

    # Validate File Type
    extension = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    allowed_types_str = await ConfigService.get_value(db, "allowed_file_types")
    if allowed_types_str:
        allowed = {t.strip().lower() for t in allowed_types_str.split(",")}
        if extension not in allowed:
            raise HTTPException(status_code=400, detail=f"File type {extension} not allowed")

    # Validate Size
    max_mb_str = await ConfigService.get_value(db, "max_upload_size_mb")
    try:
        max_bytes = int(max_mb_str) * 1024 * 1024
    except (ValueError, TypeError):
        max_bytes = 50 * 1024 * 1024
        
    if file.size and file.size > max_bytes:
         raise HTTPException(status_code=413, detail=f"File too large (max {max_mb_str}MB)")

    return await ArchiveService.update_file_content(db, file_id, file)

@router.post("/batch-action")
async def batch_action(
    batch_data: ArchiveBatchAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Handle batch move or copy actions for files and folders"""
    
    # Security: verify user has permission to access source items
    for item_id, item_type in zip(batch_data.item_ids, batch_data.item_types):
        if item_type == 'file':
            file = await ArchiveService.get_file_by_id(db, item_id)
            if not file:
                raise HTTPException(status_code=404, detail=f"File {item_id} not found")
            # Non-admin users can only access files from their unit
            if current_user.role != 'admin' and file.unit_id != current_user.unit_id:
                raise HTTPException(status_code=403, detail="Access denied to source files")
        else:
            folder = await ArchiveService.get_folder_by_id(db, item_id)
            if not folder:
                raise HTTPException(status_code=404, detail=f"Folder {item_id} not found")
            # Non-admin users can only access folders from their unit
            if current_user.role != 'admin' and folder.unit_id != current_user.unit_id:
                raise HTTPException(status_code=403, detail="Access denied to source folders")
    
    # Security: verify user has permission to write to target unit
    if batch_data.target_unit_id != current_user.unit_id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Cannot move/copy to another unit's archive")
    
    if batch_data.action == "move":
        success = await ArchiveService.move_items(
            db,
            item_ids=batch_data.item_ids,
            item_types=batch_data.item_types,
            target_folder_id=batch_data.target_folder_id,
            target_unit_id=batch_data.target_unit_id,
            is_private=batch_data.is_private
        )
    elif batch_data.action == "copy":
        success = await ArchiveService.copy_items(
            db,
            item_ids=batch_data.item_ids,
            item_types=batch_data.item_types,
            target_folder_id=batch_data.target_folder_id,
            target_unit_id=batch_data.target_unit_id,
            is_private=batch_data.is_private,
            owner_id=current_user.id
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'move' or 'copy'.")
    
    if success:
        return {"status": "success"}
    else:
        logger.error(f"Batch {batch_data.action} operation failed for user {current_user.id}. Items: {batch_data.item_ids}")
        raise HTTPException(
            status_code=500, 
            detail=f"Не удалось выполнить операцию {batch_data.action}. Проверьте права доступа к файлам и папкам."
        )

