"""Response enrichers for chat module"""
from sqlalchemy import select, func
from sqlalchemy.orm import defer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.modules.chat.models import Channel, Message, ChannelMember
from app.modules.chat.schemas import ChannelResponse, LastMessageInfo, UserBasicInfo
from app.modules.chat.service import ChatService
from app.modules.auth.models import User
from app.modules.chat.websocket import manager


async def enrich_channel(db: AsyncSession, channel: Channel, current_user_id: int) -> ChannelResponse:
    """
    Enrich channel response with DM metadata, counts, and last message.
    """
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
        # Find other member for DM channels
        resp = await enrich_direct_channel(db, channel, current_user_id, resp)
    else:
        resp.display_name = channel.name
    
    # Get last message for channel preview
    resp = await enrich_last_message(db, channel, resp)
    
    # Set pinning and mute status
    resp = await enrich_channel_settings(db, channel, current_user_id, resp)
        
    return resp


async def enrich_direct_channel(
    db: AsyncSession,
    channel: Channel,
    current_user_id: int,
    resp: ChannelResponse
) -> ChannelResponse:
    """Enrich direct message channel with other user info"""
    stmt = (
        select(User)
        .options(defer(User.hashed_password))
        .join(ChannelMember)
        .where(ChannelMember.channel_id == channel.id)
        .where(User.id != current_user_id)
    )
    result = await db.execute(stmt)
    other_user: Optional[User] = result.scalar_one_or_none()
    
    if other_user:
        resp.display_name = other_user.full_name or other_user.username
        user_info = UserBasicInfo.from_orm(other_user)
        user_info.is_online = other_user.id in manager.get_online_user_ids()
        resp.other_user = user_info
    else:
        resp.display_name = "Self" if channel.created_by == current_user_id else "Unknown"
    
    return resp


async def enrich_last_message(
    db: AsyncSession,
    channel: Channel,
    resp: ChannelResponse
) -> ChannelResponse:
    """Enrich channel with last message preview"""
    last_msg_stmt = select(Message).where(Message.channel_id == channel.id).order_by(Message.id.desc()).limit(1)
    last_msg_result = await db.execute(last_msg_stmt)
    last_msg: Optional[Message] = last_msg_result.scalar_one_or_none()
    
    if last_msg:
        sender_stmt = select(User).options(defer(User.hashed_password)).where(User.id == last_msg.user_id)
        sender_result = await db.execute(sender_stmt)
        sender: Optional[User] = sender_result.scalar_one_or_none()
        
        resp.last_message = LastMessageInfo(
            id=last_msg.id,
            content=last_msg.content[:100] if last_msg.content else "",
            sender_name=sender.full_name or sender.username if sender else "Unknown",
            created_at=last_msg.created_at
        )
    
    return resp


async def enrich_channel_settings(
    db: AsyncSession,
    channel: Channel,
    current_user_id: int,
    resp: ChannelResponse
) -> ChannelResponse:
    """Enrich channel with user-specific settings (pinned, muted)"""
    # Set pinning status
    if hasattr(channel, 'is_pinned'):
        resp.is_pinned = channel.is_pinned
    else:
        stmt = select(ChannelMember.is_pinned).where(
            ChannelMember.channel_id == channel.id,
            ChannelMember.user_id == current_user_id
        )
        result = await db.execute(stmt)
        resp.is_pinned = result.scalar() or False

    # Set mute status
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
