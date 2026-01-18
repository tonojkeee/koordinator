from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.chat.models import Channel, Message, ChannelMember, MessageReaction
from app.modules.chat.schemas import ChannelCreate, MessageCreate
from sqlalchemy.orm import selectinload
from app.modules.auth.models import User


class ChatService:
    """Service for chat operations"""
    
    @staticmethod
    async def create_channel(db: AsyncSession, channel_data: ChannelCreate, user_id: int) -> Channel:
        """Create a new channel"""
        channel = Channel(
            name=channel_data.name,
            description=channel_data.description,
            is_direct=channel_data.is_direct,
            created_by=user_id
        )
        
        db.add(channel)
        await db.commit()
        await db.refresh(channel)
        
        # Add creator as member
        member = ChannelMember(channel_id=channel.id, user_id=user_id)
        db.add(member)
        await db.commit()
        
        return channel

    @staticmethod
    async def get_or_create_direct_channel(db: AsyncSession, user_id1: int, user_id2: int) -> Channel:
        """Get or create a direct message channel between two users"""
        # Look for existing direct channel
        # Find channels that are direct AND have exactly these two users as members
        stmt = (
            select(Channel)
            .join(ChannelMember)
            .where(Channel.is_direct == True)
            .where(ChannelMember.user_id.in_([user_id1, user_id2]))
            .group_by(Channel.id)
            .having(func.count(ChannelMember.user_id) == 2)
        )
        
        result = await db.execute(stmt)
        channel = result.scalar_one_or_none()
        
        if channel:
            return channel
            
        # Create new direct channel
        channel = Channel(
            name=f"DM_{min(user_id1, user_id2)}_{max(user_id1, user_id2)}",
            is_direct=True,
            created_by=user_id1
        )
        db.add(channel)
        await db.commit()
        await db.refresh(channel)
        
        # Add both members
        db.add(ChannelMember(channel_id=channel.id, user_id=user_id1))
        db.add(ChannelMember(channel_id=channel.id, user_id=user_id2))
        await db.commit()
        
        return channel
    
    @staticmethod
    async def get_channel_by_id(db: AsyncSession, channel_id: int) -> Optional[Channel]:
        """Get channel by ID"""
        result = await db.execute(select(Channel).where(Channel.id == channel_id))
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_channels(db: AsyncSession, user_id: int) -> List[Channel]:
        """Get all channels for a user:
        - All public channels (visible to everyone)
        - DM channels where user is a member AND there is at least one message
        """
        from sqlalchemy import or_, exists
        
        # Subquery to check if channel has any messages
        message_exists = exists().where(Message.channel_id == Channel.id)
        
        result = await db.execute(
            select(Channel, ChannelMember.is_pinned, ChannelMember.mute_until)
            .outerjoin(ChannelMember, and_(ChannelMember.channel_id == Channel.id, ChannelMember.user_id == user_id))
            .where(
                or_(
                    Channel.is_direct == False,  # All public channels
                    and_(
                        Channel.is_direct == True,
                        ChannelMember.user_id == user_id,
                        or_(message_exists, ChannelMember.is_pinned == True)
                    )
                )
            )
            .distinct()
            .order_by(func.coalesce(ChannelMember.is_pinned, False).desc(), Channel.created_at.desc())
        )
        
        channels = []
        for row in result:
            channel, is_pinned, mute_until = row
            # Set temporary attributes for schema
            channel.is_pinned = is_pinned or False
            channel.mute_until = mute_until
            channels.append(channel)
        return channels
    
    @staticmethod
    async def get_channel_member_ids(db: AsyncSession, channel_id: int) -> List[int]:
        """Get all user IDs that are members of a channel"""
        result = await db.execute(
            select(ChannelMember.user_id)
            .where(ChannelMember.channel_id == channel_id)
        )
        return list(result.scalars().all())
    
    @staticmethod
    async def create_message(db: AsyncSession, message_data: MessageCreate, user_id: int, document_id: Optional[int] = None) -> Message:
        """Create a new message and update sender's last_read_message_id"""
        message = Message(
            channel_id=message_data.channel_id,
            user_id=user_id,
            content=message_data.content,
            document_id=document_id,
            parent_id=message_data.parent_id
        )
        
        db.add(message)
        await db.commit()
        await db.refresh(message, ["user"])
        
        # Update sender's last_read_message_id
        stmt = select(ChannelMember).where(
            and_(ChannelMember.channel_id == message.channel_id, ChannelMember.user_id == user_id)
        )
        result = await db.execute(stmt)
        member = result.scalars().first()
        if member:
            member.last_read_message_id = message.id
            await db.commit()
            
        return message
    
    @staticmethod
    async def get_channel_messages(
        db: AsyncSession, 
        channel_id: int, 
        limit: int = 50,
        offset: int = 0
    ) -> List[Message]:
        """Get messages for a channel (top-level only)"""
        
        from sqlalchemy.orm import aliased
        ReplyMsg = aliased(Message)
        ParentMsg = aliased(Message)
        ParentUser = aliased(User)
        
        # Subquery to count replies (still useful if we want to show it, though less critical in Telegram style)
        reply_count_subquery = (
            select(func.count(ReplyMsg.id))
            .where(ReplyMsg.parent_id == Message.id)
            .correlate(Message)
            .scalar_subquery()
        )

        result = await db.execute(
            select(
                Message, 
                reply_count_subquery.label("reply_count"),
                ParentMsg,
                ParentUser
            )
            .outerjoin(ParentMsg, Message.parent_id == ParentMsg.id)
            .outerjoin(ParentUser, ParentMsg.user_id == ParentUser.id)
            .options(selectinload(Message.reactions).selectinload(MessageReaction.user))
            .where(Message.channel_id == channel_id) # Removed parent_id.is_(None) check to show all messages
            .order_by(Message.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        # Result is list of (Message, reply_count, ParentMsg, ParentUser) tuples
        rows = result.all()
        messages = []
        for row in rows:
            msg = row[0]
            count = row[1]
            parent_msg = row[2]
            parent_user = row[3]
            
            msg.reply_count = count
            
            # Attach parent info manually to be used by router
            if parent_msg:
                msg.parent_info = {
                    "id": parent_msg.id,
                    "content": parent_msg.content,
                    "username": parent_user.username if parent_user else "Unknown",
                    "full_name": parent_user.full_name if parent_user else None
                }
            else:
                msg.parent_info = None
                
            messages.append(msg)
            
        return list(reversed(messages))

    @staticmethod
    async def get_replies(
        db: AsyncSession,
        parent_id: int
    ) -> List[Message]:
        """Get replies for a message thread"""
        result = await db.execute(
            select(Message)
            .options(selectinload(Message.reactions).selectinload(MessageReaction.user))
            .where(Message.parent_id == parent_id)
            .order_by(Message.created_at.asc())
        )
        return list(result.scalars().all())
    
    @staticmethod
    async def is_user_member(db: AsyncSession, channel_id: int, user_id: int) -> bool:
        """Check if user is a member of a channel.
        Uses .first() instead of .scalar_one_or_none() to be resilient against duplicates.
        """
        result = await db.execute(
            select(ChannelMember).where(
                and_(
                    ChannelMember.channel_id == channel_id,
                    ChannelMember.user_id == user_id
                )
            )
        )
        return result.first() is not None
    
    @staticmethod
    async def add_member(db: AsyncSession, channel_id: int, user_id: int) -> ChannelMember:
        """Add a user to a channel. Checks if already a member first."""
        # Check if already a member to prevent duplicates
        is_member = await ChatService.is_user_member(db, channel_id, user_id)
        if is_member:
            # Just return the existing member (or a mock if we don't need the object)
            result = await db.execute(
                select(ChannelMember).where(
                    and_(
                        ChannelMember.channel_id == channel_id,
                        ChannelMember.user_id == user_id
                    )
                )
            )
            return result.scalars().first()
            
        member = ChannelMember(channel_id=channel_id, user_id=user_id)
        db.add(member)
        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def delete_channel(db: AsyncSession, channel_id: int, user: User) -> bool:
        """Delete a channel. Creator/Admin only for groups, any member/Admin for DMs."""
        channel = await ChatService.get_channel_by_id(db, channel_id)
        if not channel:
            return False
            
        # Permission check: Admin can delete anything
        if user.role != 'admin':
            if channel.is_direct:
                # Any member can delete a DM (it deletes it for both)
                is_member = await ChatService.is_user_member(db, channel_id, user.id)
                if not is_member:
                    return False
            else:
                # Only creator can delete public channels
                if channel.created_by != user.id:
                    return False
        
        # Delete messages, members, and finally the channel
        await db.execute(delete(Message).where(Message.channel_id == channel_id))
        await db.execute(delete(ChannelMember).where(ChannelMember.channel_id == channel_id))
        await db.delete(channel)
        await db.commit()
        return True

    @staticmethod
    async def get_unread_count(db: AsyncSession, channel_id: int, user_id: int) -> int:
        """Get unread message count for a user in a channel"""
        # Get member info for last_read_message_id
        stmt = select(ChannelMember).where(
            and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
        )
        result = await db.execute(stmt)
        member = result.scalars().first()
        
        if not member:
            return 0
            
        last_id = member.last_read_message_id or 0
        
        # Count messages in this channel with id > last_id
        count_stmt = select(func.count(Message.id)).where(
            and_(Message.channel_id == channel_id, Message.id > last_id)
        )
        result = await db.execute(count_stmt)
        return result.scalar() or 0

    @staticmethod
    async def mark_channel_as_read(db: AsyncSession, channel_id: int, user_id: int) -> Optional[int]:
        """Update last_read_message_id for a user in a channel to the latest message ID"""
        # Get latest message ID in channel
        latest_stmt = select(Message.id).where(Message.channel_id == channel_id).order_by(Message.id.desc()).limit(1)
        result = await db.execute(latest_stmt)
        latest_id = result.scalar()
        
        if latest_id is None:
            return None
            
        # Update member record
        stmt = select(ChannelMember).where(
            and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
        )
        result = await db.execute(stmt)
        member = result.scalars().first()
        
        if member:
            member.last_read_message_id = latest_id
            await db.commit()
            return latest_id
            
        return None
    @staticmethod
    async def add_reaction(db: AsyncSession, message_id: int, user_id: int, emoji: str) -> MessageReaction:
        """Add a reaction to a message"""
        # Check if already exists
        stmt = select(MessageReaction).where(
            and_(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user_id,
                MessageReaction.emoji == emoji
            )
        )
        result = await db.execute(stmt)
        reaction = result.scalars().first()
        
        if reaction:
            return reaction
            
        reaction = MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji)
        db.add(reaction)
        await db.commit()
        await db.refresh(reaction)
        
        # Load user info
        stmt = select(MessageReaction).options(selectinload(MessageReaction.user)).where(MessageReaction.id == reaction.id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def remove_reaction(db: AsyncSession, message_id: int, user_id: int, emoji: str) -> bool:
        """Remove a reaction from a message"""
        stmt = delete(MessageReaction).where(
            and_(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user_id,
                MessageReaction.emoji == emoji
            )
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def toggle_pin_channel(db: AsyncSession, channel_id: int, user_id: int) -> bool:
        """Toggle channel pinning for a user"""
        stmt = select(ChannelMember).where(
            and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
        )
        result = await db.execute(stmt)
        member = result.scalars().first()
        
        if not member:
            # Not a member, can't pin (unless it's public, then maybe autojoin? 
            # For simplicity, let's say user must be a member to pin)
            # Public channels might need auto-join or we just return False
            return False
            
        member.is_pinned = not member.is_pinned
        await db.commit()
        return member.is_pinned

    @staticmethod
    async def set_mute_status(db: AsyncSession, channel_id: int, user_id: int, mute_until: Optional[datetime]) -> bool:
        """Set mute status for a channel"""
        stmt = select(ChannelMember).where(
            and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
        )
        result = await db.execute(stmt)
        member = result.scalars().first()
        
        if not member:
            return False
            
        member.mute_until = mute_until
        await db.commit()
        return True

    @staticmethod
    async def delete_message(db: AsyncSession, message_id: int, user_id: int, is_admin: bool = False) -> Optional[Message]:
        """Delete a message. Only the message author or admin can delete.
        Returns the message if successfully deleted, None if not found or unauthorized."""
        # Get the message
        stmt = select(Message).where(Message.id == message_id)
        result = await db.execute(stmt)
        message = result.scalars().first()
        
        if not message:
            return None
        
        # Authorization check: only message author or admin can delete
        if message.user_id != user_id and not is_admin:
            return None
        
        # Store message data before deletion for return
        message_copy = Message(
            id=message.id,
            channel_id=message.channel_id,
            user_id=message.user_id,
            document_id=message.document_id,
            content=message.content,
            created_at=message.created_at
        )
        
        # Delete the message (cascade will handle reactions)
        await db.delete(message)
        await db.commit()
        
        return message_copy
