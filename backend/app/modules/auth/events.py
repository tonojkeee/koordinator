from app.core.events import Event
from dataclasses import dataclass

@dataclass
class UserCreated(Event):
    user_id: int
    username: str
    email: str

@dataclass
class UserDeleted(Event):
    user_id: str

@dataclass
class UserUpdated(Event):
    user_id: int
    changes: dict
