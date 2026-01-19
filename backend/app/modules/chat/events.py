from app.core.events import Event
from dataclasses import dataclass

@dataclass
class MessageCreated(Event):
    message_id: int
    channel_id: int
    user_id: int
    content: str
