"""
Domain Events for Board Module

Events published when board-related actions occur,
enabling cross-module communication without direct dependencies.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DocumentSharedEvent:
    """
    Event published when a document is shared with another user.

    Used by chat module to create channel/message notifications.
    """
    document_id: int
    document_title: str
    document_path: str
    sender_id: int
    recipient_id: int
    sender_username: str
    sender_full_name: str
    sender_avatar_url: str | None
    channel_id: int | None
    message_id: int | None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat)
