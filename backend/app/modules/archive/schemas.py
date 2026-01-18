from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class ArchiveFolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[int] = None

class ArchiveFolderCreate(ArchiveFolderBase):
    unit_id: Optional[int] = None
    is_private: bool = False

class ArchiveFolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)

class ArchiveFolderResponse(ArchiveFolderBase):
    id: int
    unit_id: int
    owner_id: int
    owner_name: Optional[str] = None
    is_private: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class ArchiveFileBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    folder_id: Optional[int] = None

class ArchiveFileCreate(ArchiveFileBase):
    pass

class ArchiveFileUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

class ArchiveFileResponse(ArchiveFileBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    owner_id: int
    owner_name: Optional[str] = None
    unit_id: int
    unit_name: Optional[str] = None
    is_private: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class ArchiveContentResponse(BaseModel):
    folders: List[ArchiveFolderResponse]
    files: List[ArchiveFileResponse]

class UnitArchiveResponse(BaseModel):
    unit_id: int
    unit_name: str
    files: List[ArchiveFileResponse]
class ArchiveBatchAction(BaseModel):
    action: str = Field(..., description="copy or move")
    item_ids: List[int]
    item_types: List[str]
    target_folder_id: Optional[int] = None
    target_unit_id: int
    is_private: bool = False
