from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class EmailAccount(Base):
    __tablename__ = "email_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    email_address: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    
    # Optional: for sending credentials if we decide to relay through external SMTP later
    # smtp_server: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # smtp_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # smtp_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="email_account")
    messages = relationship("EmailMessage", back_populates="account", cascade="all, delete-orphan")
    folders = relationship("EmailFolder", back_populates="account", cascade="all, delete-orphan")


class EmailFolder(Base):
    __tablename__ = "email_folders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("email_accounts.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("EmailAccount", back_populates="folders")
    messages = relationship("EmailMessage", back_populates="folder")


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("email_accounts.id"), nullable=False, index=True)
    
    # Metadata
    subject: Mapped[Optional[str]] = mapped_column(String(998), nullable=True) # RFC 5322 limit
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    to_address: Mapped[str] = mapped_column(String(1000), nullable=False) # Can be multiple comma-separated
    cc_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bcc_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Usually only stored for sent messages
    
    # Content
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Flags
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_sent: Mapped[bool] = mapped_column(default=False, nullable=False, index=True) # True if sent by user, False if received
    is_draft: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False, index=True) # Soft delete (Trash)
    is_starred: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_important: Mapped[bool] = mapped_column(default=False, nullable=False)
    
    folder_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_folders.id"), nullable=True, index=True)
    
    message_id_header: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True) # Message-ID header
    
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    account = relationship("EmailAccount", back_populates="messages")
    folder = relationship("EmailFolder", back_populates="messages")
    attachments = relationship("EmailAttachment", back_populates="message", cascade="all, delete-orphan")

    @property
    def has_attachments(self) -> bool:
        return len(self.attachments) > 0


class EmailAttachment(Base):
    __tablename__ = "email_attachments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("email_messages.id"), nullable=False, index=True)
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=True)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False) # Path on disk
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("EmailMessage", back_populates="attachments")
