from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.modules.auth.schemas import UserResponse
from app.modules.board.models import ShareStatus

class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

class DocumentCreate(DocumentBase):
    pass

class DocumentShareCreate(BaseModel):
    recipient_id: Optional[int] = None
    recipient_ids: Optional[List[int]] = None

class DocumentShareUpdate(BaseModel):
    status: ShareStatus

class DocumentResponse(DocumentBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    owner_id: int
    created_at: datetime
    owner: Optional[UserResponse] = None 

    class Config:
        from_attributes = True

class ChannelBasicInfo(BaseModel):
    id: int
    name: str

class DocumentShareResponse(BaseModel):
    id: int
    document_id: int
    recipient_id: int
    status: ShareStatus
    created_at: datetime
    updated_at: datetime
    document: Optional[DocumentResponse] = None
    recipient: Optional[UserResponse] = None
    channels: List[ChannelBasicInfo] = []

    class Config:
        from_attributes = True
