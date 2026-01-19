from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import os
import uuid
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.modules.auth.router import get_current_user
from app.modules.auth.models import User
from app.modules.board.schemas import (
    DocumentCreate, DocumentResponse, DocumentShareCreate, DocumentShareResponse
)
from app.modules.board.service import BoardService
from app.modules.chat.service import ChatService
from app.core.config_service import ConfigService
from app.modules.admin.service import SystemSettingService

# Security Constants
UPLOAD_DIR = "uploads/documents"
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png", ".gif", ".txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

router = APIRouter(prefix="/board", tags=["Electronic Board"])

@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    title: str,
    description: str = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a new document"""
    # Validation
    extension = os.path.splitext(file.filename)[1].lower()
    
    # Get settings from DB
    allowed_types_str = await ConfigService.get_value(db, "allowed_file_types")
    allowed_extensions = {ext.strip() for ext in allowed_types_str.split(",")} if allowed_types_str else ALLOWED_EXTENSIONS
    
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {extension} not allowed")

    # Create directory if not exists
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Generate unique filename
    filename = f"{uuid.uuid4()}{extension}"
    file_path = f"{UPLOAD_DIR}/{filename}"

    # Save file with size limit check
    size = 0
    
    # Get max size from DB
    max_size_mb_str = await ConfigService.get_value(db, "max_upload_size_mb")
    try:
        max_size = int(max_size_mb_str) * 1024 * 1024
    except (ValueError, TypeError):
        max_size = MAX_FILE_SIZE

    try:
        with open(file_path, "wb") as buffer:
            for chunk in iter(lambda: file.file.read(8192), b""):
                size += len(chunk)
                if size > max_size:
                    buffer.close()
                    try:
                        os.remove(file_path)
                    except OSError as cleanup_err:
                        logger.error(f"Failed to cleanup oversized file {file_path}: {cleanup_err}")
                    raise HTTPException(status_code=413, detail=f"File too large (max {max_size_mb_str}MB)")
                buffer.write(chunk)
    except HTTPException:
        raise
    except (OSError, IOError) as e:
        logger.error(f"File I/O error during upload: {e}")
        # Cleanup partial file if it exists
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail="Не удалось сохранить файл. Проверьте права доступа к диску.")
    except Exception as e:
        logger.error(f"Unexpected error during file upload: {e}")
        # Cleanup partial file if it exists
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail="Произошла ошибка при загрузке файла. Попробуйте еще раз.")

    # Save to DB (internal path without leading slash for easier local handling)
    doc_data = DocumentCreate(title=title, description=description)
    document = await BoardService.create_document(
        db, doc_data, file_path=file_path, owner_id=current_user.id, file_size=size
    )
    return document

import mimetypes
from fastapi import Request
from app.core.file_security import secure_file_response, safe_file_path

# Ensure common office types are registered
mimetypes.add_type('application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx')
mimetypes.add_type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx')
mimetypes.add_type('application/vnd.ms-excel', '.xls')

@router.get("/documents/{doc_id}/download")
@router.get("/documents/{doc_id}/view")
async def get_document_file(
    request: Request,
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Securely serve a document file if authorized"""
    document = await BoardService.get_document_by_id(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check authorization: owner OR recipient (direct or via group)
    is_authorized = False
    if document.owner_id == current_user.id:
        is_authorized = True
    else:
        # Check direct share
        share = await BoardService.get_document_share(db, doc_id, current_user.id)
        if share:
            is_authorized = True
        else:
            # Check if document was shared in a channel where user is a member
            from sqlalchemy import select
            from app.modules.chat.models import Message, ChannelMember
            stmt = select(Message.id).join(ChannelMember, Message.channel_id == ChannelMember.channel_id).where(
                Message.document_id == doc_id,
                ChannelMember.user_id == current_user.id
            ).limit(1)
            result = await db.execute(stmt)
            if result.scalar():
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to access this document")

    # Secure path validation - prevents path traversal
    try:
        safe_path = safe_file_path(document.file_path, UPLOAD_DIR)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating file path: {e}")
        raise HTTPException(status_code=403, detail="Invalid file path")
    
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Determine filename and media type
    mime_type, _ = mimetypes.guess_type(safe_path)
    if not mime_type:
        mime_type = "application/octet-stream"
        
    is_download = "download" in request.url.path
    content_disposition = "attachment" if is_download else "inline"
    
    # Use document title for download filename, ensuring it has extension
    download_filename = os.path.basename(document.file_path)
    if is_download:
        original_ext = os.path.splitext(document.file_path)[1]
        display_name = document.title
        if not display_name.lower().endswith(original_ext.lower()):
            display_name += original_ext
        download_filename = display_name

    return secure_file_response(
        safe_path,
        filename=download_filename if is_download else None,
        media_type=mime_type,
        content_disposition=content_disposition
    )

@router.get("/documents/owned", response_model=List[DocumentResponse])
async def get_my_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get documents owned by current user"""
    return await BoardService.get_owned_documents(db, current_user.id)

@router.get("/documents/received", response_model=List[DocumentShareResponse])
async def get_received_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get documents shared with current user"""
    return await BoardService.get_shared_with_me_documents(db, current_user.id)

@router.post("/documents/{doc_id}/share", response_model=DocumentShareResponse)
async def share_document(
    doc_id: int,
    share_data: DocumentShareCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Share a document with another user"""
    # Check ownership
    document = await BoardService.get_document_by_id(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to share this document")

    # Get or create DM channel for the share
    channel = await ChatService.get_or_create_direct_channel(db, current_user.id, share_data.recipient_id)

    # Share document and publish event
    # Chat module subscribes to DocumentSharedEvent and handles notifications
    share = await BoardService.share_document(
        db, doc_id, share_data.recipient_id,
        channel_id=channel.id,
        sender_user=current_user
    )

    # Broadcast "new_message" notification to recipient (for UI feedback)
    from app.core.websocket_manager import websocket_manager as manager
    await manager.broadcast_to_user(share_data.recipient_id, {
        "type": "new_message",
        "channel_id": channel.id,
        "channel_name": current_user.full_name or current_user.username,
        "is_direct": True,
    })
    
    # Broadcast "new_message" notification to the recipient
    await manager.broadcast_to_user(share_data.recipient_id, {
        "type": "new_message",
        "channel_id": channel.id,
        "channel_name": current_user.full_name or current_user.username,
        "is_direct": True,
        "message": {
            "id": msg.id,
            "content": msg.content,
            "sender_id": current_user.id,
            "sender_name": current_user.full_name or current_user.username,
            "created_at": msg.created_at.isoformat(),
            "document_id": document.id,
            "document_title": document.title,
            "file_path": document.file_path
        }
    })

    # Broadcast "document_shared" for board indicator
    await manager.broadcast_to_user(share_data.recipient_id, {
        "type": "document_shared",
        "document_id": document.id,
        "channel_id": channel.id,
        "title": document.title,
        "owner_name": current_user.full_name or current_user.username,
        "created_at": document.created_at.isoformat(),
        "file_path": document.file_path
    })

    return share



async def _parse_recipient_ids(recipient_ids: str) -> List[int]:
    """Parse and validate recipient IDs from comma-separated string"""
    try:
        r_ids = [int(id.strip()) for id in recipient_ids.split(",") if id.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid recipient_ids format")
    
    if not r_ids:
        raise HTTPException(status_code=400, detail="At least one recipient is required")
    
    return r_ids


async def _validate_file_and_channel(
    file: UploadFile,
    channel_id: Optional[int],
    current_user: User,
    db: AsyncSession
) -> set:
    """Validate file type and channel membership"""
    extension = os.path.splitext(file.filename)[1].lower()
    
    allowed_types_str = await ConfigService.get_value(db, "allowed_file_types")
    allowed_extensions = {ext.strip() for ext in allowed_types_str.split(",")} if allowed_types_str else ALLOWED_EXTENSIONS
    
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {extension} not allowed")
    
    if channel_id:
        is_member = await ChatService.is_user_member(db, channel_id, current_user.id)
        if not is_member:
            raise HTTPException(status_code=403, detail="You are not a member of this channel")
    
    return allowed_extensions


async def _save_uploaded_file(file: UploadFile, extension: str, db: AsyncSession) -> tuple[str, int]:
    """Save uploaded file and return file path and size"""
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    filename = f"{uuid.uuid4()}{extension}"
    file_path = f"{UPLOAD_DIR}/{filename}"

    size = 0
    max_size_mb_str = await ConfigService.get_value(db, "max_upload_size_mb")
    try:
        max_size = int(max_size_mb_str) * 1024 * 1024
    except (ValueError, TypeError):
        max_size = MAX_FILE_SIZE

    try:
        with open(file_path, "wb") as buffer:
            for chunk in iter(lambda: file.file.read(8192), b""):
                size += len(chunk)
                if size > max_size:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail=f"File too large (max {max_size_mb_str}MB)")
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not save file")
    
    return file_path, size


async def _share_document_with_recipients(
    db: AsyncSession,
    document,
    recipient_ids: List[int],
    current_user_id: int
):
    """Share document with all recipients"""
    for r_id in recipient_ids:
        if r_id == current_user_id:
            continue
        await BoardService.share_document(db, document.id, r_id)


async def _post_document_to_channel(
    db: AsyncSession,
    channel_id: int,
    document,
    description: Optional[str],
    current_user: User
):
    """Post document message to channel and broadcast"""
    from app.modules.chat.schemas import MessageCreate as ChatMessageCreate
    from app.core.websocket_manager import websocket_manager as manager
    
    msg_content = description if description else f"📎 Отправил файл: {document.title}"
    msg_data = ChatMessageCreate(channel_id=channel_id, content=msg_content)
    msg = await ChatService.create_message(db, msg_data, current_user.id, document_id=document.id)
    
    await manager.broadcast_to_channel(channel_id, {
        "id": msg.id,
        "channel_id": msg.channel_id,
        "user_id": msg.user_id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "content": msg.content,
        "document_id": document.id,
        "document_title": document.title,
        "file_path": document.file_path,
        "created_at": msg.created_at.isoformat()
    })
    
    member_ids = await ChatService.get_channel_member_ids(db, channel_id)
    for m_id in member_ids:
        if m_id == current_user.id:
            continue
        
        await manager.broadcast_to_user(m_id, {
            "type": "new_message",
            "channel_id": channel_id,
            "message": {
                "id": msg.id,
                "content": msg.content,
                "sender_id": current_user.id,
                "sender_name": current_user.full_name or current_user.username,
                "created_at": msg.created_at.isoformat(),
                "document_id": document.id,
                "document_title": document.title,
                "file_path": document.file_path
            }
        })
        
        await manager.broadcast_to_user(m_id, {
            "type": "document_shared",
            "document_id": document.id,
            "channel_id": channel_id,
            "title": document.title,
            "owner_name": current_user.full_name or current_user.username,
            "created_at": document.created_at.isoformat(),
            "file_path": document.file_path
        })


async def _send_document_via_dms(
    db: AsyncSession,
    document,
    recipient_ids: List[int],
    description: Optional[str],
    current_user: User
):
    """Send document to recipients via direct messages"""
    from app.modules.chat.schemas import MessageCreate as ChatMessageCreate
    from app.core.websocket_manager import websocket_manager as manager
    
    msg_content = description if description else f"📎 Поделился файлом: {document.title}"
    
    for r_id in recipient_ids:
        if r_id == current_user.id:
            continue
        
        dm_channel = await ChatService.get_or_create_direct_channel(db, current_user.id, r_id)
        dm_msg = await ChatService.create_message(
            db, 
            ChatMessageCreate(channel_id=dm_channel.id, content=msg_content), 
            current_user.id, 
            document_id=document.id
        )
        
        await manager.broadcast_to_channel(dm_channel.id, {
            "id": dm_msg.id,
            "channel_id": dm_channel.id,
            "user_id": dm_msg.user_id,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "avatar_url": current_user.avatar_url,
            "content": dm_msg.content,
            "document_id": document.id,
            "document_title": document.title,
            "file_path": document.file_path,
            "created_at": dm_msg.created_at.isoformat()
        })

        await manager.broadcast_to_user(r_id, {
            "type": "new_message",
            "channel_id": dm_channel.id,
            "is_direct": True,
            "message": {
                "id": dm_msg.id,
                "content": dm_msg.content,
                "sender_id": current_user.id,
                "sender_name": current_user.full_name or current_user.username,
                "created_at": dm_msg.created_at.isoformat(),
                "document_id": document.id,
                "document_title": document.title,
                "file_path": document.file_path
            }
        })

        await manager.broadcast_to_user(r_id, {
            "type": "document_shared",
            "document_id": document.id,
            "channel_id": dm_channel.id,
            "title": document.title,
            "owner_name": current_user.full_name or current_user.username,
            "created_at": document.created_at.isoformat(),
            "file_path": document.file_path
        })


@router.post("/documents/upload-and-share", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_and_share_document(
    title: str,
    recipient_ids: str,
    description: str = None,
    channel_id: int = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a new document and share it with multiple users"""
    r_ids = await _parse_recipient_ids(recipient_ids)
    await _validate_file_and_channel(file, channel_id, current_user, db)
    
    extension = os.path.splitext(file.filename)[1].lower()
    file_path, size = await _save_uploaded_file(file, extension, db)

    doc_data = DocumentCreate(title=title, description=description)
    document = await BoardService.create_document(
        db, doc_data, file_path=file_path, owner_id=current_user.id, file_size=size
    )

    await _share_document_with_recipients(db, document, r_ids, current_user.id)
    
    if channel_id:
        await _post_document_to_channel(db, channel_id, document, description, current_user)
    else:
        await _send_document_via_dms(db, document, r_ids, description, current_user)

    return document

@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a document"""
    document = await BoardService.get_document_by_id(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    # Delete file
    # Remove leading slash for os.remove
    file_path_sys = document.file_path.lstrip("/")
    if os.path.exists(file_path_sys):
        try:
            os.remove(file_path_sys)
        except OSError:
            pass # changes nothing if file already gone

    await BoardService.delete_document(db, doc_id)
    return None
