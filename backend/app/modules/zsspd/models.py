from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum

class ZsspdDirection(str, enum.Enum):
    INCOMING = "INCOMING"
    OUTGOING = "OUTGOING"

class ZsspdStatus(str, enum.Enum):
    # Outgoing statuses
    DRAFT = "DRAFT"
    READY = "READY"
    EXPORTED = "EXPORTED"
    SENT = "SENT"
    
    # Incoming statuses
    RECEIVED = "RECEIVED"
    DISTRIBUTED = "DISTRIBUTED"
    
    # Common
    ARCHIVED = "ARCHIVED"

class ZsspdPackage(Base):
    __tablename__ = "zsspd_packages"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    direction: Mapped[ZsspdDirection] = mapped_column(Enum(ZsspdDirection), nullable=False)
    status: Mapped[ZsspdStatus] = mapped_column(Enum(ZsspdStatus), default=ZsspdStatus.DRAFT, nullable=False)
    
    # Metadata
    external_sender: Mapped[str] = mapped_column(String(255), nullable=True) # For incoming
    external_recipient: Mapped[str] = mapped_column(String(255), nullable=True) # For outgoing
    outgoing_number: Mapped[str] = mapped_column(String(100), nullable=True) # Essential for outgoing
    subject: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # Linking
    operator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    files = relationship("ZsspdFile", back_populates="package", cascade="all, delete-orphan", lazy="selectin")
    recipients = relationship("ZsspdRecipient", back_populates="package", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
    operator = relationship("User", foreign_keys=[operator_id])


class ZsspdFile(Base):
    __tablename__ = "zsspd_files"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("zsspd_packages.id"), nullable=False, index=True)
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    package = relationship("ZsspdPackage", back_populates="files")


class ZsspdRecipient(Base):
    __tablename__ = "zsspd_recipients"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("zsspd_packages.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    package = relationship("ZsspdPackage", back_populates="recipients")
    user = relationship("User")
