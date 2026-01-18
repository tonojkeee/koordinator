from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    cabinet: Mapped[str] = mapped_column(String(20), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), nullable=True, index=True)
    rank: Mapped[str] = mapped_column(String(50), nullable=True)
    position: Mapped[str] = mapped_column(String(100), nullable=True)
    birth_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(255), nullable=True)
    notify_browser: Mapped[bool] = mapped_column(default=True, nullable=False)
    notify_sound: Mapped[bool] = mapped_column(default=True, nullable=False)
    notify_email: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        nullable=False
    )
    preferences: Mapped[dict] = mapped_column(JSON, default={}, nullable=False)

    @property
    def unit_name(self) -> Optional[str]:
        return self.unit.name if self.unit else None

    # Relationships
    unit = relationship("Unit", back_populates="members")


class Unit(Base):
    __tablename__ = "units"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    members = relationship("User", back_populates="unit")
