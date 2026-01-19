from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class FolderStats(BaseModel):
    folder_id: str
    folder_name: str
    count: int
    unread_count: int


class EmailStats(BaseModel):
    inbox: int
    sent: int
    important: int
    starred: int
    archived: int
    trash: int
    total: int


class UnreadCount(BaseModel):
    total: int

# --- Attachment Schemas ---
class EmailAttachmentBase(BaseModel):
    filename: str
    content_type: Optional[str] = None
    file_size: int

class EmailAttachment(EmailAttachmentBase):
    id: int
    file_path: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Email Message Schemas ---
class EmailMessageBase(BaseModel):
    subject: Optional[str] = None
    to_address: str # Comma separated for inputs
    cc_address: Optional[str] = None
    bcc_address: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    
class EmailMessageCreate(EmailMessageBase):
    pass

class EmailMessageUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_deleted: Optional[bool] = None
    is_starred: Optional[bool] = None
    is_important: Optional[bool] = None
    folder_id: Optional[int] = None

class EmailMessage(EmailMessageBase):
    id: int
    account_id: int
    from_address: str
    is_read: bool
    is_sent: bool
    is_draft: bool
    is_archived: bool
    is_deleted: bool
    is_starred: bool
    is_important: bool
    folder_id: Optional[int] = None
    received_at: datetime
    attachments: List[EmailAttachment] = []

    class Config:
        from_attributes = True

class EmailMessageList(BaseModel):
    id: int
    subject: Optional[str]
    from_address: str
    to_address: str
    is_read: bool
    is_sent: bool
    is_starred: bool
    is_important: bool
    received_at: datetime
    has_attachments: bool

    class Config:
        from_attributes = True

# --- Email Account Schemas ---
class EmailAccountBase(BaseModel):
    email_address: str

class EmailAccountCreate(EmailAccountBase):
    user_id: int

class EmailAccount(EmailAccountBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Email Folder Schemas ---
class EmailFolderBase(BaseModel):
    name: str

class EmailFolderCreate(EmailFolderBase):
    pass

class EmailFolder(EmailFolderBase):
    id: int
    account_id: int
    slug: str
    is_system: bool
    created_at: datetime

    class Config:
        from_attributes = True
