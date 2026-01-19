from app.core.events import Event
from dataclasses import dataclass

@dataclass
class DocumentShared(Event):
    document_id: int
    sender_id: int
    recipient_id: int
    channel_id: int

@dataclass
class DocumentUploaded(Event):
    document_id: int
    owner_id: int
    title: str
