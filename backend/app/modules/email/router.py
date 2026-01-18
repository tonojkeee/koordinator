from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import os
import mimetypes

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.router import get_current_user
from app.modules.email import service
from app.modules.email import schemas
from app.core.file_security import safe_file_path
from app.core.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/email", tags=["Email"])

UPLOAD_DIR = "uploads/email_attachments"

@router.get("/account", response_model=schemas.EmailAccount)
async def get_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        # Auto-create for now if doesn't exist? Or return 404?
        # Let's auto-create <username>@coordinator.local
        email_address = f"{current_user.username}@coordinator.local"
        account = await service.create_email_account(db, current_user.id, email_address)
    return account

@router.get("/messages", response_model=List[schemas.EmailMessageList])
async def list_messages(
    folder: str = Query("inbox", enum=["inbox", "sent", "trash", "archive", "starred", "important"]),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    
    return await service.get_emails(db, account.id, folder, skip, limit)

@router.get("/messages/{message_id}", response_model=schemas.EmailMessage)
async def get_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
        
    message = await service.get_email_by_id(db, message_id, account.id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    # Mark as read if not sent by us
    if not message.is_read:
        message.is_read = True
        await db.commit()
    
    return message

@router.post("/send", response_model=schemas.EmailMessage)
async def send_email(
    email_data: schemas.EmailMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    
    return await service.send_email(db, account.id, email_data)

@router.patch("/messages/{message_id}", response_model=schemas.EmailMessage)
async def update_message(
    message_id: int,
    updates: schemas.EmailMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    
    updated = await service.update_email_message(db, message_id, account.id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found")
    return updated

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    
    await service.delete_email_message(db, message_id, account.id)
    return {"status": "success"}

# --- Folders ---

@router.get("/folders", response_model=List[schemas.EmailFolder])
async def list_folders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    return await service.get_folders(db, account.id)

@router.post("/folders", response_model=schemas.EmailFolder)
async def create_folder(
    folder_data: schemas.EmailFolderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    return await service.create_folder(db, account.id, folder_data)

@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    account = await service.get_user_email_account(db, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not set up")
    await service.delete_folder(db, folder_id, account.id)
    return {"status": "success"}

@router.get("/attachments/{attachment_id}/download")
async def download_email_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Securely download email attachment if authorized"""
    attachment = await service.get_email_attachment(db, attachment_id, current_user.id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found or not authorized")
    
    # Secure path validation - prevents path traversal
    try:
        safe_path = safe_file_path(attachment.file_path, UPLOAD_DIR)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=403, detail="Invalid file path")
    
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Determine filename and media type
    mime_type, _ = mimetypes.guess_type(safe_path)
    if not mime_type:
        mime_type = "application/octet-stream"
    
    # Use attachment filename for download
    return FileResponse(
        path=safe_path,
        media_type=mime_type,
        filename=attachment.filename
    )
