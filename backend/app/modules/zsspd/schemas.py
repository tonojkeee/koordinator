from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .models import ZsspdDirection, ZsspdStatus

class UserBasicInfo(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    rank: Optional[str] = None
    position: Optional[str] = None
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class ZsspdFileBase(BaseModel):
    filename: str
    file_size: int

class ZsspdFileRead(ZsspdFileBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class ZsspdPackageBase(BaseModel):
    subject: Optional[str] = None
    external_sender: Optional[str] = None
    external_recipient: Optional[str] = None
    outgoing_number: Optional[str] = None

class ZsspdPackageCreate(ZsspdPackageBase):
    direction: ZsspdDirection

class ZsspdPackageUpdate(BaseModel):
    status: Optional[ZsspdStatus] = None
    subject: Optional[str] = None
    external_recipient: Optional[str] = None
    outgoing_number: Optional[str] = None

class ZsspdPackageRead(ZsspdPackageBase):
    id: int
    direction: ZsspdDirection
    status: ZsspdStatus
    created_by: int
    operator_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    files: List[ZsspdFileRead] = []
    creator: Optional[UserBasicInfo] = None
    
    class Config:
        from_attributes = True
