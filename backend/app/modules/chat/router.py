from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
import logging
import os
import bleach
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, defer
from typing import List, Optional

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import decode_access_token
from app.core.file_security import safe_file_operation
from app.core.rate_limit import rate_limit_chat_message
from app.modules.auth.router import get_current_user
from app.modules.auth.models import User
from app.modules.auth.service import UserService
from app.modules.chat.schemas import (
    ChannelCreate, 
    ChannelResponse, 
    MessageCreate, 
    MessageResponse,
    MessageWithUser,
    UserBasicInfo,
    MessageParentInfo
)
from app.modules.chat.service import ChatService
from app.modules.admin.service import SystemSettingService
from app.modules.chat.models import ChannelMember, Channel, Message
from app.modules.chat.websocket import manager

router = APIRouter(prefix="/chat", tags=["Chat"])


def sanitize_message_content(content: str) -> str:
    """
    Sanitize message content to prevent XSS attacks.
    For chat messages, we remove all HTML tags to ensure plain text only.
    """
    if not content:
        return content
    
    # Remove all HTML tags - chat messages should be plain text
    return bleach.clean(
        content,
        tags=[],  # No HTML tags allowed
        strip=True  # Strip tags instead of escaping
    )


def validate_emoji(emoji: str) -> bool:
    """
    Validate that emoji is a valid Unicode emoji character.
    Returns True if valid, False otherwise.
    """
    import re
    
    if not emoji or len(emoji) > 10:
        return False
    
    # Allow Unicode emoji range (basic emoji support)
    # This is a simplified check - a full implementation would use a proper emoji library
    emoji_pattern = r'^[\U0001F300-\U0001F9FF\u2600-\u26FF\u2700-\u27BF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF]+$'
    return bool(re.match(emoji_pattern, emoji))


async def enrich_channel(db: AsyncSession, channel: Channel, current_user_id: int) -> ChannelResponse:
    """Enrich channel response with DM metadata and counts"""
    resp = ChannelResponse.from_orm(channel)
    
    # Get member count
    member_count_stmt = select(func.count(ChannelMember.id)).where(ChannelMember.channel_id == channel.id)
    result = await db.execute(member_count_stmt)
    resp.members_count = result.scalar() or 0
    
    # Get online count by intersecting channel members with globally online users
    member_ids = await ChatService.get_channel_member_ids(db, channel.id)
    online_user_ids = set(manager.get_online_user_ids())
    resp.online_count = len(online_user_ids.intersection(set(member_ids)))
    
    # Get unread count and last_read_message_id for current user
    stmt = select(ChannelMember).where(
        ChannelMember.channel_id == channel.id,
        ChannelMember.user_id == current_user_id
    )
    result = await db.execute(stmt)
    member = result.scalars().first()
    
    if member:
        resp.last_read_message_id = member.last_read_message_id
        resp.unread_count = await ChatService.get_unread_count(db, channel.id, current_user_id)
    
    # Get max last_read_message_id from others
    others_read_stmt = select(func.max(ChannelMember.last_read_message_id)).where(
        ChannelMember.channel_id == channel.id,
        ChannelMember.user_id != current_user_id
    )
    others_read_result = await db.execute(others_read_stmt)
    resp.others_read_id = others_read_result.scalar() or 0

    if channel.is_direct:
        # Find the other member
        stmt = (
            select(User)
            .options(defer(User.hashed_password))
            .join(ChannelMember)
            .where(ChannelMember.channel_id == channel.id)
            .where(User.id != current_user_id)
        )
        result = await db.execute(stmt)
        other_user = result.scalar_one_or_none()
        
        if other_user:
            resp.display_name = other_user.full_name or other_user.username
            user_info = UserBasicInfo.from_orm(other_user)
            user_info.is_online = other_user.id in manager.get_online_user_ids()
            resp.other_user = user_info
        else:
            resp.display_name = "Self" if channel.created_by == current_user_id else "Unknown"
    else:
        resp.display_name = channel.name
    
    # Get last message for channel preview
    from app.modules.chat.schemas import LastMessageInfo
    last_msg_stmt = select(Message).where(Message.channel_id == channel.id).order_by(Message.id.desc()).limit(1)
    last_msg_result = await db.execute(last_msg_stmt)
    last_msg = last_msg_result.scalar_one_or_none()
    
    if last_msg:
        sender_stmt = select(User).options(defer(User.hashed_password)).where(User.id == last_msg.user_id)
        sender_result = await db.execute(sender_stmt)
        sender = sender_result.scalar_one_or_none()
        resp.last_message = LastMessageInfo(
            id=last_msg.id,
            content=last_msg.content[:100] if last_msg.content else "",
            sender_name=sender.full_name or sender.username if sender else "Unknown",
            created_at=last_msg.created_at
        )
    
    # Set pinning status
    if hasattr(channel, 'is_pinned'):
        resp.is_pinned = channel.is_pinned
    else:
        # Check from DB if not already on object
        stmt = select(ChannelMember.is_pinned).where(
            ChannelMember.channel_id == channel.id,
            ChannelMember.user_id == current_user_id
        )
        result = await db.execute(stmt)
        resp.is_pinned = result.scalar() or False

    # Set mute status from object or DB
    if hasattr(channel, 'mute_until'):
        resp.mute_until = channel.mute_until
    else:
        stmt = select(ChannelMember.mute_until).where(
            ChannelMember.channel_id == channel.id,
            ChannelMember.user_id == current_user_id
        )
        result = await db.execute(stmt)
        resp.mute_until = result.scalar()       
        
    return resp


@router.post("/channels/{channel_id}/read")
async def mark_channel_as_read(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in a channel as read for current user"""
    last_id = await ChatService.mark_channel_as_read(db, channel_id, current_user.id)
    
    # Broadcast read receipt to the channel
    await manager.broadcast_to_channel(channel_id, {
        "type": "read_receipt",
        "channel_id": channel_id,
        "user_id": current_user.id,
        "last_read_id": last_id
    })

    return {"status": "success", "last_read_message_id": last_id}


@router.post("/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    channel_data: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new channel"""
    # Check permissions
    if current_user.role != "admin":
        allow_create = await SystemSettingService.get_value(db, "chat_allow_create_channel")
        if str(allow_create).lower() != "true":
             raise HTTPException(status_code=403, detail="Создание каналов запрещено администратором")

    channel = await ChatService.create_channel(db, channel_data, current_user.id)
    
    # Enrich channel response
    enriched_channel = await enrich_channel(db, channel, current_user.id)
    
    # For public channels, broadcast to ALL connected users
    # For DMs, only notify the creator (DMs are handled separately in /direct endpoint)
    if not channel.is_direct:
        await manager.broadcast_to_all_users({
            "type": "channel_created",
            "channel": {
                "id": enriched_channel.id,
                "name": enriched_channel.name,
                "display_name": enriched_channel.display_name,
                "is_direct": enriched_channel.is_direct,
                "members_count": enriched_channel.members_count,
                "online_count": enriched_channel.online_count,
                "other_user": None,
                "created_at": enriched_channel.created_at.isoformat()
            }
        })
    
    return enriched_channel


@router.get("/channels", response_model=List[ChannelResponse])
async def get_my_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all channels for current user"""
    channels = await ChatService.get_user_channels(db, current_user.id)
    return [await enrich_channel(db, c, current_user.id) for c in channels]


@router.get("/channels/{channel_id}", response_model=ChannelResponse)
async def get_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific channel"""
    channel = await ChatService.get_channel_by_id(db, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Канал не найден"
        )
    
    # Check if user is a member
    is_member = await ChatService.is_user_member(db, channel_id, current_user.id)
    
    # For public channels, auto-join the user if not already a member
    if not is_member:
        if not channel.is_direct:
            # Public channel - auto-join
            await ChatService.add_member(db, channel_id, current_user.id)
        else:
            # DM channel - no access allowed
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Вы не являетесь участником этого канала"
            )
    
    return await enrich_channel(db, channel, current_user.id)


@router.get("/channels/{channel_id}/messages", response_model=List[MessageWithUser])
async def get_channel_messages(
    channel_id: int,
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Determine limit
    if limit is None:
        setting_val = await SystemSettingService.get_value(db, "chat_page_size")
        try:
            limit = int(setting_val)
        except (ValueError, TypeError):
            limit = 50
            
    # Check if user is a member
    is_member = await ChatService.is_user_member(db, channel_id, current_user.id)
    if not is_member:
        channel = await ChatService.get_channel_by_id(db, channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Чат не найден")
        
        if not channel.is_direct:
            # Auto-join public channel
            await ChatService.add_member(db, channel_id, current_user.id)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Вы не являетесь участником этого канала"
            )

    messages = await ChatService.get_channel_messages(db, channel_id, limit, offset)

    # Batch load users and documents to avoid N+1 queries
    user_ids = {msg.user_id for msg in messages if msg.user_id}
    document_ids = {msg.document_id for msg in messages if msg.document_id}
    
    # Load all users at once
    users_dict = {}
    if user_ids:
        users_result = await db.execute(
            select(User).where(User.id.in_(user_ids)).options(defer(User.hashed_password))
        )
        users_dict = {user.id: user for user in users_result.scalars().all()}
    
    # Load all documents at once
    documents_dict = {}
    if document_ids:
        from app.modules.board.models import Document
        docs_result = await db.execute(
            select(Document).where(Document.id.in_(document_ids))
        )
        documents_dict = {doc.id: doc for doc in docs_result.scalars().all()}
    
    # Enrich messages with user info and document info
    result = []
    for msg in messages:
        user = users_dict.get(msg.user_id)
        
        doc_info = {"is_document_deleted": False}
        if msg.document_id:
            doc = documents_dict.get(msg.document_id)
            if doc:
                doc_info["document_title"] = doc.title
                doc_info["file_path"] = doc.file_path
            else:
                doc_info["is_document_deleted"] = True
        
        from app.modules.chat.schemas import ReactionResponse
        
        result.append(MessageWithUser(
            id=msg.id,
            channel_id=msg.channel_id,
            user_id=msg.user_id,
            document_id=msg.document_id,
            content=msg.content,
            created_at=msg.created_at,
            username=user.username if user else "Unknown",
            full_name=user.full_name if user else None,
            rank=user.rank if user else None,
            role=user.role if user else None,
            avatar_url=user.avatar_url if user else None,
            reactions=[
                ReactionResponse(
                    emoji=r.emoji,
                    user_id=r.user_id,
                    username=r.user.username if r.user else "Unknown"
                ) for r in msg.reactions
            ],
            **doc_info,
            reply_count=getattr(msg, "reply_count", 0),
            parent=msg.parent_info if hasattr(msg, "parent_info") and msg.parent_info else None
        ))
    
    return result


@router.get("/messages/{message_id}/replies", response_model=List[MessageWithUser])
async def get_message_replies(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get replies for a specific message thread"""
    # Check if user has access to the channel of the parent message
    parent_message = await db.get(Message, message_id)
    if not parent_message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
        
    is_member = await ChatService.is_user_member(db, parent_message.channel_id, current_user.id)
    if not is_member:
         raise HTTPException(status_code=403, detail="Нет доступа к этому чату")

    messages = await ChatService.get_replies(db, message_id)

    # Batch load users and documents to avoid N+1 queries
    user_ids = {msg.user_id for msg in messages if msg.user_id}
    document_ids = {msg.document_id for msg in messages if msg.document_id}
    
    # Load all users at once
    users_dict = {}
    if user_ids:
        users_result = await db.execute(
            select(User).where(User.id.in_(user_ids)).options(defer(User.hashed_password))
        )
        users_dict = {user.id: user for user in users_result.scalars().all()}
    
    # Load all documents at once
    documents_dict = {}
    if document_ids:
        from app.modules.board.models import Document
        docs_result = await db.execute(
            select(Document).where(Document.id.in_(document_ids))
        )
        documents_dict = {doc.id: doc for doc in docs_result.scalars().all()}

    # Enrich messages
    result = []
    for msg in messages:
        user = users_dict.get(msg.user_id)
        
        doc_info = {"is_document_deleted": False}
        if msg.document_id:
            doc = documents_dict.get(msg.document_id)
            if doc:
                doc_info["document_title"] = doc.title
                doc_info["file_path"] = doc.file_path
            else:
                doc_info["is_document_deleted"] = True
        
        from app.modules.chat.schemas import ReactionResponse
        
        result.append(MessageWithUser(
            id=msg.id,
            channel_id=msg.channel_id,
            user_id=msg.user_id,
            document_id=msg.document_id,
            parent_id=msg.parent_id,
            content=msg.content,
            created_at=msg.created_at,
            username=user.username if user else "Unknown",
            full_name=user.full_name if user else None,
            rank=user.rank if user else None,
            role=user.role if user else None,
            avatar_url=user.avatar_url if user else None,
            reactions=[
                ReactionResponse(
                    emoji=r.emoji,
                    user_id=r.user_id,
                    username=r.user.username if r.user else "Unknown"
                ) for r in msg.reactions
            ],
            **doc_info,
            reply_count=0  # Replies don't have nested replies in this simple implementation
        ))
    
    return result


@router.post("/channels/{channel_id}/pin")
async def toggle_pin_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle channel pinning for current user"""
    is_pinned = await ChatService.toggle_pin_channel(db, channel_id, current_user.id)
    return {"status": "success", "is_pinned": is_pinned}


@router.post("/channels/{channel_id}/mute")
async def mute_channel(
    channel_id: int,
    mute_until: Optional[str] = Query(None, description="ISO format datetime string, or null to unmute"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mute notifications for a channel until a specific time"""
    from datetime import datetime
    
    mute_dt = None
    if mute_until:
        try:
            mute_dt = datetime.fromisoformat(mute_until.replace('Z', '+00:00'))
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid datetime format")
             
    success = await ChatService.set_mute_status(db, channel_id, current_user.id, mute_dt)
    if not success:
         # Auto-join if public? Logic implies user must be member.
         # For now, just error if not member.
         raise HTTPException(status_code=404, detail="Channel not found or you are not a member")
         
    return {"status": "success", "mute_until": mute_until}


@router.post("/messages/{message_id}/reactions")
async def add_reaction(
    message_id: int,
    emoji: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a reaction to a message"""
    # Validate emoji format
    if not validate_emoji(emoji):
        raise HTTPException(status_code=400, detail="Недопустимый формат эмодзи")
    
    # Get message to find channel_id
    from app.modules.chat.models import Message
    stmt = select(Message).where(Message.id == message_id)
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
        
    # Check if user has access to this channel
    is_member = await ChatService.is_user_member(db, message.channel_id, current_user.id)
    if not is_member:
        raise HTTPException(status_code=403, detail="Нет доступа")
        
    reaction = await ChatService.add_reaction(db, message_id, current_user.id, emoji)
    
    # Broadcast to channel
    await manager.broadcast_to_channel(message.channel_id, {
        "type": "reaction_added",
        "message_id": message_id,
        "reaction": {
            "emoji": reaction.emoji,
            "user_id": reaction.user_id,
            "username": current_user.username,
            "avatar_url": current_user.avatar_url
        }
    })
    
    return {"status": "success"}


@router.delete("/messages/{message_id}/reactions")
async def remove_reaction(
    message_id: int,
    emoji: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a reaction from a message"""
    from app.modules.chat.models import Message
    stmt = select(Message).where(Message.id == message_id)
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
        
    success = await ChatService.remove_reaction(db, message_id, current_user.id, emoji)
    
    if success:
        # Broadcast to channel
        await manager.broadcast_to_channel(message.channel_id, {
            "type": "reaction_removed",
            "message_id": message_id,
            "emoji": emoji,
            "user_id": current_user.id
        })
        
    return {"status": "success"}
    
    
@router.get("/channels/{channel_id}/members", response_model=List[UserBasicInfo])
async def get_channel_members(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all members of a channel"""
    # Check if user is a member
    is_member = await ChatService.is_user_member(db, channel_id, current_user.id)
    if not is_member:
        channel = await ChatService.get_channel_by_id(db, channel_id)
        if not channel or (channel.is_direct):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет доступа к списку участников этого чата"
            )
        # For public channels, we allow viewing members if not joined? 
        # Actually, let's just require membership for now to keep it simple.
    
    member_ids = await ChatService.get_channel_member_ids(db, channel_id)
    
    stmt = select(User).where(User.id.in_(member_ids))
    result = await db.execute(stmt)
    users = result.scalars().all()

    online_user_ids = manager.get_online_user_ids()
    result = []
    for u in users:
        user_info = UserBasicInfo.from_orm(u)
        user_info.is_online = u.id in online_user_ids
        result.append(user_info)
        
    return result


@router.websocket("/ws/user")
@router.websocket("/ws/user")
async def user_websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for global user notifications (new channels, etc.)"""
    import asyncio
    
    # STEP 1: Authenticate BEFORE accepting connection
    try:
        payload = decode_access_token(token)
        if not payload:
            logger.warning("Invalid token, rejecting connection")
            return
        
        user_id_str = payload.get("sub")
        if not user_id_str:
            logger.warning("No user_id in token, rejecting connection")
            return
        
        user_id = int(user_id_str)

        # Check if user is active and connection limit
        async with AsyncSessionLocal() as db:
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if not user or not user.is_active:
                logger.warning(f"User {user_id} is inactive or not found, rejecting connection")
                return
            
            # Check connection limit BEFORE accepting
            existing_connections = len(manager.user_connections.get(user_id, []))
            if existing_connections >= 5:
                logger.warning(f"User {user_id} has too many connections ({existing_connections}), rejecting")
                return
    except Exception as e:
        logger.error(f"Pre-authentication error: {e}")
        return
    
    # STEP 2: Now accept the connection (only if all checks passed)
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to accept WebSocket connection: {e}")
        return
    
    # STEP 3: Add to user_connections
    try:
        is_first_connection = user_id not in manager.user_connections
        if is_first_connection:
            manager.user_connections[user_id] = []
        manager.user_connections[user_id].append(websocket)
        
        # Update last_seen in DB immediately & broadcast online status
        if is_first_connection:
            try:
                async with AsyncSessionLocal() as db_session:
                    from sqlalchemy import update
                    from datetime import datetime
                    await db_session.execute(
                        update(User).where(User.id == user_id).values(last_seen=datetime.utcnow())
                    )
                    await db_session.commit()
                    
                await manager.broadcast_to_all_users({
                    "type": "user_presence",
                    "user_id": user_id,
                    "status": "online"
                })
            except Exception as e:
                logger.error(f"Error in connection setup side-effects for user {user_id}: {e}")
                
    except Exception as e:
        logger.error(f"Critical error in WebSocket setup for user {user_id}: {e}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except (RuntimeError, WebSocketDisconnect) as close_error:
            logger.debug(f"WebSocket already closed or disconnected: {close_error}")
            pass
        return
    
    try:
        # Keep the connection alive
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=45.0)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"User {user_id} WebSocket error: {e}")
    finally:
        await manager.disconnect_user(websocket, user_id)
        # Final last_seen update on disconnect
        try:
            async with AsyncSessionLocal() as db:
                from datetime import datetime
                from sqlalchemy import update
                await db.execute(
                    update(User).where(User.id == user_id).values(last_seen=datetime.utcnow())
                )
                await db.commit()
        except (SQLAlchemyError, Exception) as db_err:
            logger.error(f"Error updating last_seen on disconnect: {db_err}")
        logger.info(f"Cleaned up connection for user {user_id}")



@router.websocket("/ws/{channel_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    channel_id: int,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time messaging"""
    # Authenticate user
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # Convert to int (JWT stores sub as string)
    user_id = int(user_id_str)
    
    # Get DB session
    async with AsyncSessionLocal() as db:
        # Check if user is a member
        is_member = await ChatService.is_user_member(db, channel_id, user_id)
        if not is_member:
            channel = await ChatService.get_channel_by_id(db, channel_id)
            if not channel:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            if not channel.is_direct:
                # Auto-join public channel
                await ChatService.add_member(db, channel_id, user_id)
            else:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        
        # Get user info
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Account disabled")
            return
    
    # Connect
    await manager.connect(websocket, channel_id, user_id)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            
            # Handle typing indicator
            if data.get("type") == "typing":
                await manager.broadcast_to_channel(channel_id, {
                    "type": "typing",
                    "user_id": user_id,
                    "username": user.username,
                    "full_name": user.full_name,
                    "is_typing": data.get("is_typing", True)
                }, exclude_websocket=websocket)
                continue
                
            content = data.get("content", "").strip()
            document_id = data.get("document_id")
            parent_id = data.get("parent_id")
            
            # Sanitize content
            if content:
                content = sanitize_message_content(content)
            
            if not content and not document_id:
                continue
            
            # Check message length
            async with AsyncSessionLocal() as db:
                max_len_setting = await SystemSettingService.get_value(db, "chat_max_message_length")
                try:
                    max_len = int(max_len_setting)
                except (ValueError, TypeError):
                    max_len = 4000
                    
                if len(content) > max_len:
                    await websocket.send_json({
                        "type": "error", 
                        "message": f"Сообщение слишком длинное. Максимум {max_len} символов."
                    })
                    continue

                # Rate limiting check
                if not await rate_limit_chat_message(user_id, db):
                    await websocket.send_json({
                        "type": "error", 
                        "message": "Слишком много сообщений. Пожалуйста, подождите."
                    })
                    continue
            
            # Parse mentions
            import re
            mention_pattern = r'@(\w+)'
            mentioned_usernames = set(re.findall(mention_pattern, content))
            mentioned_user_ids = []
            
            if mentioned_usernames:
                async with AsyncSessionLocal() as db_session:
                    mention_stmt = select(User).where(User.username.in_(mentioned_usernames))
                    mention_result = await db_session.execute(mention_stmt)
                    mentioned_users = mention_result.scalars().all()
                    mentioned_user_ids = [u.id for u in mentioned_users]

            # Save message to database
            async with AsyncSessionLocal() as db:
                message_data = MessageCreate(
                    channel_id=channel_id, 
                    content=content, 
                    document_id=document_id,
                    parent_id=parent_id
                )
                message = await ChatService.create_message(db, message_data, user_id, document_id=document_id)
                
                # Get channel info for notification
                channel = await ChatService.get_channel_by_id(db, channel_id)
                
                # Get document info if exists
                doc_info = {"is_document_deleted": False}
                if document_id:
                    from app.modules.board.models import Document
                    doc_result = await db.execute(select(Document).where(Document.id == document_id))
                    doc = doc_result.scalar_one_or_none()
                    if doc:
                        doc_info["document_title"] = doc.title
                        doc_info["file_path"] = doc.file_path
                    else:
                        doc_info["is_document_deleted"] = True

                # Get parent info if exists
                parent_info = None
                if message.parent_id:
                    parent_msg_stmt = select(Message).options(selectinload(Message.user)).where(Message.id == message.parent_id)
                    parent_result = await db.execute(parent_msg_stmt)
                    parent_msg = parent_result.scalars().first()
                    if parent_msg:
                        parent_info = {
                            "id": parent_msg.id,
                            "content": parent_msg.content,
                            "username": parent_msg.user.username if parent_msg.user else "Unknown",
                            "full_name": parent_msg.user.full_name if parent_msg.user else None
                        }

                # Broadcast to all connected clients in the channel WebSocket
                
                # Use data from refreshed message.user
                msg_user = message.user
                
                await manager.broadcast_to_channel(channel_id, {
                    "type": "new_message",
                    "id": message.id,
                    "channel_id": message.channel_id,
                    "user_id": message.user_id,
                    "username": msg_user.username if msg_user else "Unknown",
                    "full_name": msg_user.full_name if msg_user else None,
                    "rank": msg_user.rank if msg_user else None,
                    "role": msg_user.role if msg_user else "user",
                    "avatar_url": msg_user.avatar_url if msg_user else None,
                    "content": message.content,
                    "document_id": message.document_id,
                    "parent_id": message.parent_id,
                    "parent": parent_info,
                    **doc_info,
                    "created_at": message.created_at.isoformat(),
                    "mentions": mentioned_user_ids,
                    "reply_count": 0
                })
                
                # Also broadcast to all channel members via global WebSocket
                # This notifies users who are not currently viewing the channel
                member_ids = await ChatService.get_channel_member_ids(db, channel_id)
                for member_id in member_ids:
                    # Don't notify the sender
                    if member_id == user_id:
                        continue
                    
                    is_mentioned = member_id in mentioned_user_ids
                    
                    await manager.broadcast_to_user(member_id, {
                        "type": "new_message",
                        "channel_id": channel_id,
                        "channel_name": channel.name if channel else None,
                        "is_direct": channel.is_direct if channel else False,
                        "is_mentioned": is_mentioned,
                        "message": {
                            "id": message.id,
                            "content": message.content[:100],  # Truncate for notification
                            "sender_id": user_id,
                            "sender_name": user.full_name or user.username,
                            "created_at": message.created_at.isoformat()
                        }
                    })
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket, channel_id, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket, channel_id, user_id)


@router.post("/direct/{user_id}", response_model=ChannelResponse)
async def start_direct_message(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start or get a direct message channel with another user"""
    # logger.debug(f"Starting DM: current_user={current_user.id} -> target_user={user_id}")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя начать чат с самим собой")
    
    # Check if target user exists
    target_user = await UserService.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Check if channel already exists
    existing_channel = await ChatService.get_or_create_direct_channel(db, current_user.id, user_id)
    # logger.debug(f"Channel: id={existing_channel.id}, is_direct={existing_channel.is_direct}")
    
    # Get member IDs
    member_ids = await ChatService.get_channel_member_ids(db, existing_channel.id)
    # logger.debug(f"Member IDs from DB: {member_ids} (types: {[type(m).__name__ for m in member_ids]})")
    
    # Debug: show current WebSocket connections
    # logger.debug(f"Current WebSocket user_connections keys: {list(manager.user_connections.keys())}")
    # logger.debug(f"Connection key types: {[type(k).__name__ for k in manager.user_connections.keys()]}")
    
    # Enrich the channel response for the current user
    channel_response = await enrich_channel(db, existing_channel, current_user.id)
    
    # We do NOT broadcast channel_created to the target user yet.
    # The DM should only appear for them once they receive the first message.
    
    return channel_response


@router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a channel or DM"""
    # Get channel info and members BEFORE deleting
    channel = await ChatService.get_channel_by_id(db, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    member_ids = await ChatService.get_channel_member_ids(db, channel_id)
    channel_name = channel.name
    is_direct = channel.is_direct
    
    # Perform deletion
    success = await ChatService.delete_channel(db, channel_id, current_user)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления этого чата"
        )
    
    # Notify all members about the deletion
    for member_id in member_ids:
        # Don't notify the user who deleted the channel
        if member_id == current_user.id:
            continue
        
        await manager.broadcast_to_user(member_id, {
            "type": "channel_deleted",
            "channel_id": channel_id,
            "channel_name": channel_name,
            "is_direct": is_direct,
            "deleted_by": {
                "id": current_user.id,
                "username": current_user.username,
                "full_name": current_user.full_name
            }
        })
    
    return {"status": "success"}

@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a message. Only the message author or admin can delete."""
    is_admin = current_user.role == "admin"
    
    # Check system setting if not admin
    if not is_admin:
        allow_delete = await SystemSettingService.get_value(db, "chat_allow_delete")
        if str(allow_delete).lower() != "true":
             raise HTTPException(status_code=403, detail="Удаление сообщений запрещено администратором")

    
    deleted_message = await ChatService.delete_message(db, message_id, current_user.id, is_admin)
    
    if not deleted_message:
        raise HTTPException(status_code=404, detail="Message not found or unauthorized")
    
    # If message had a document, delete the file
    if deleted_message.document_id:
        try:
            from app.modules.board.models import Document
            stmt = select(Document).where(Document.id == deleted_message.document_id)
            result = await db.execute(stmt)
            document = result.scalars().first()
            
            if document:
                # Secure file deletion with path validation
                try:
                    safe_path = safe_file_operation(document.file_path, "uploads/documents")
                    if os.path.exists(safe_path):
                        os.remove(safe_path)
                except ValueError as e:
                    logger.error(f"Path traversal detected in document deletion: {e}")
                except Exception as e:
                    logger.error(f"Error deleting document file: {e}")
                
                await db.delete(document)
                await db.commit()
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
    
    # Broadcast deletion
    await manager.broadcast_to_channel(deleted_message.channel_id, {
        "type": "message_deleted",
        "message_id": message_id,
        "channel_id": deleted_message.channel_id
    })
    
    return None
