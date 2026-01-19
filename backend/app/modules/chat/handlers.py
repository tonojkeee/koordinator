"""
Event Handlers for Chat Module

Subscribes to events from other modules and handles them.
"""

from app.core.events import EventBus
from app.core.websocket_manager import websocket_manager as manager


async def handle_document_shared(event) -> None:
    """
    Handle DocumentSharedEvent from board module.

    Creates a message in the shared channel about the document.
    Broadcasts the message to all channel participants.
    """
    from app.modules.chat.service import ChatService
    from app.modules.chat.schemas import MessageCreate
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # Create message content
        msg_content = f"📎 Поделился файлом: {event.document_title}"
        msg_data = MessageCreate(
            channel_id=event.channel_id,
            content=msg_content,
            document_id=event.document_id
        )

        # Create message
        msg = await ChatService.create_message(
            db, msg_data, event.sender_id, document_id=event.document_id
        )

        # Broadcast message to channel
        await manager.broadcast_to_channel(event.channel_id, {
            "id": msg.id,
            "channel_id": msg.channel_id,
            "user_id": msg.user_id,
            "username": event.sender_username,
            "full_name": event.sender_full_name,
            "avatar_url": event.sender_avatar_url,
            "content": msg.content,
            "document_id": event.document_id,
            "document_title": event.document_title,
            "file_path": event.document_path,
            "created_at": event.created_at
        })


async def register_event_handlers(event_bus: EventBus) -> None:
    """
    Register all event handlers for chat module.

    Call this in main.py lifespan to activate event handling.
    """
    from app.modules.board.events import DocumentSharedEvent

    await event_bus.subscribe(DocumentSharedEvent, handle_document_shared)
