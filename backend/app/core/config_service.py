from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.models import SystemSetting
from typing import Any, Optional

class ConfigService:
    """Centralized configuration service (moved from admin)"""

    @staticmethod
    async def get_value(
        db: AsyncSession,
        key: str,
        default: Any = None,
        group: str = "general"
    ) -> Any:
        """Get configuration value with default"""
        result = await db.execute(
            select(SystemSetting).where(
                (SystemSetting.key == key) &
                (SystemSetting.group == group)
            )
        )
        setting = result.scalar_one_or_none()
        if setting is None:
            return default
        return setting.value

    @staticmethod
    async def set_value(
        db: AsyncSession,
        key: str,
        value: Any,
        group: str = "general"
    ):
        """Set configuration value"""
        result = await db.execute(
            select(SystemSetting).where(
                (SystemSetting.key == key) &
                (SystemSetting.group == group)
            )
        )
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = value
        else:
            setting = SystemSetting(key=key, value=value, group=group)
            db.add(setting)

        await db.commit()
