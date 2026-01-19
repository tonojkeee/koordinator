"""
Core Database Models

Infrastructure-level models that are shared across modules.
These are not domain-specific models, but rather system-level entities.
"""

from datetime import datetime
from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class SystemSetting(Base):
    """
    System-wide configuration settings stored in database.

    Allows for dynamic configuration changes without code deployment.
    Settings can be organized by group (general, security, email, storage, etc.)
    """
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(20), default="str")  # str, int, bool, json
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    group: Mapped[str] = mapped_column(String(50), default="general")  # general, security, email, storage
