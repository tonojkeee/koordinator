from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    OPERATOR = "operator"


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)
    cabinet: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=20)
    unit_id: Optional[int] = None
    rank: Optional[str] = Field(None, max_length=50)
    position: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[datetime] = None
    role: str = "user"
    avatar_url: Optional[str] = Field(None, max_length=500)
    notify_browser: bool = True
    notify_sound: bool = True
    notify_email: bool = False
    preferences: dict = {}


class UnitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class UnitCreate(UnitBase):
    pass


class UnitUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class UnitResponse(UnitBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: Optional[str] = Field(None, max_length=100)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    cabinet: Optional[str] = Field(None, max_length=50)
    rank: Optional[str] = Field(None, max_length=50)
    position: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[datetime] = None
    notify_browser: Optional[bool] = None
    notify_sound: Optional[bool] = None
    notify_email: Optional[bool] = None
    preferences: Optional[dict] = None



class AdminUserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    cabinet: Optional[str] = Field(None, max_length=50)
    rank: Optional[str] = Field(None, max_length=50)
    position: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[datetime] = None
    role: Optional[str] = None
    unit_id: Optional[int] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None


class AdminResetPassword(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str = Field(..., max_length=128)


class UserResponse(UserBase):
    id: int
    is_active: bool
    status: str
    created_at: datetime
    last_seen: Optional[datetime] = None
    session_start: Optional[datetime] = None
    unit_name: Optional[str] = None
    rank: Optional[str] = None
    position: Optional[str] = None
    birth_date: Optional[datetime] = None
    preferences: dict = {}
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    csrf_token: Optional[str] = None  # CSRF token for state-changing operations


class TokenData(BaseModel):
    user_id: Optional[int] = None


class RoleUpdate(BaseModel):
    role: UserRole


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)
