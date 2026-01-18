from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class UserBasicInfo(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    rank: Optional[str] = None
    avatar_url: Optional[str] = None
    last_seen: Optional[datetime] = None
    is_online: bool = False

    class Config:
        from_attributes = True


class ReactionResponse(BaseModel):
    emoji: str
    user_id: int
    username: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class ChannelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_direct: bool = False


class ChannelCreate(ChannelBase):
    pass


class LastMessageInfo(BaseModel):
    id: int
    content: str
    sender_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChannelResponse(ChannelBase):
    id: int
    created_by: int
    created_at: datetime
    display_name: Optional[str] = None
    other_user: Optional[UserBasicInfo] = None
    members_count: int = 0
    online_count: int = 0
    unread_count: int = 0
    last_read_message_id: Optional[int] = None
    others_read_id: Optional[int] = None
    others_read_id: Optional[int] = None
    is_pinned: bool = False
    mute_until: Optional[datetime] = None
    last_message: Optional[LastMessageInfo] = None
    
    class Config:
        from_attributes = True


class MessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class MessageCreate(MessageBase):
    channel_id: int
    document_id: Optional[int] = None
    parent_id: Optional[int] = None


class MessageResponse(MessageBase):
    id: int
    channel_id: int
    user_id: int
    document_id: Optional[int] = None
    parent_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class MessageParentInfo(BaseModel):
    id: int
    content: str
    username: str
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class MessageWithUser(MessageResponse):
    username: str
    full_name: Optional[str] = None
    rank: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    document_title: Optional[str] = None
    file_path: Optional[str] = None
    is_document_deleted: bool = False
    reactions: List[ReactionResponse] = []
    reply_count: int = 0
    parent: Optional[MessageParentInfo] = None

