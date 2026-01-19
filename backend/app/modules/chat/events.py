from app.core.events import Event
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Event:
    pass


@dataclass(frozen=True)
class MessageCreated(Event):
    message_id: int
    channel_id: int
    user_id: int
    content: str
    document_id: int | None = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat)
