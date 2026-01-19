"""
Database Seeding Script

This script seeds the database with default data:
- System settings
- Default organizational units
- Test users

Run this after database initialization:
    python -m scripts.seed_db
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from app.core.database import AsyncSessionLocal
from app.core.models import SystemSetting
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.modules.auth.models import User, Unit
from app.modules.chat.models import ChannelMember


settings = get_settings()


async def cleanup_duplicate_channel_memberships(session: AsyncSession) -> None:
    """Remove duplicate channel memberships to allow UniqueConstraint"""
    subquery = (
        select(func.min(ChannelMember.id).label('min_id'))
        .group_by(ChannelMember.channel_id, ChannelMember.user_id)
        .subquery()
    )

    stmt = delete(ChannelMember).where(
        ChannelMember.id.notin_(select(subquery.c.min_id))
    )
    await session.execute(stmt)
    await session.commit()


async def seed_system_settings(session: AsyncSession) -> None:
    """Create default system settings if they don't exist"""
    default_settings = [
        {"key": "app_name", "value": settings.app_name, "type": "str", "group": "general", "description": "Название приложения", "is_public": True},
        {"key": "maintenance_mode", "value": "false", "type": "bool", "group": "general", "description": "Режим технического обслуживания", "is_public": True},
        {"key": "support_contact", "value": "support@example.com", "type": "str", "group": "general", "description": "Контакты техподдержки", "is_public": True},
        {"key": "system_notice", "value": "", "type": "str", "group": "general", "description": "Системное объявление (баннер)", "is_public": True},
        {"key": "internal_email_domain", "value": settings.internal_email_domain, "type": "str", "group": "email", "description": "Домен для внутренней почты", "is_public": True},
        {"key": "email_max_attachment_size_mb", "value": "25", "type": "int", "group": "email", "description": "Максимальный размер одного вложения (МБ)", "is_public": True},
        {"key": "email_max_total_attachment_size_mb", "value": "50", "type": "int", "group": "email", "description": "Максимальный общий размер вложений (МБ)", "is_public": True},
        {"key": "email_allowed_file_types", "value": ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.jpg,.png,.txt", "type": "str", "group": "email", "description": "Разрешенные типы вложений", "is_public": True},
        {"key": "email_smtp_host", "value": "127.0.0.1", "type": "str", "group": "email", "description": "SMTP Хост", "is_public": False},
        {"key": "email_smtp_port", "value": "2525", "type": "int", "group": "email", "description": "SMTP Порт", "is_public": False},
        {"key": "access_token_expire_minutes", "value": str(settings.access_token_expire_minutes), "type": "int", "group": "security", "description": "Время жизни токена доступа (минуты)", "is_public": False},
        {"key": "refresh_token_expire_days", "value": str(settings.refresh_token_expire_days), "type": "int", "group": "security", "description": "Время жизни токена обновления (дни)", "is_public": False},
        {"key": "security_password_min_length", "value": "8", "type": "int", "group": "security", "description": "Минимальная длина пароля", "is_public": True},
        {"key": "security_password_require_digits", "value": "false", "type": "bool", "group": "security", "description": "Требовать цифры в пароле", "is_public": True},
        {"key": "security_password_require_uppercase", "value": "false", "type": "bool", "group": "security", "description": "Требовать заглавные буквы", "is_public": True},
        {"key": "allow_registration", "value": "true", "type": "bool", "group": "security", "description": "Разрешить самостоятельную регистрацию", "is_public": True},
        {"key": "max_upload_size_mb", "value": "50", "type": "int", "group": "chat", "description": "Максимальный размер загружаемого файла (МБ)", "is_public": True},
        {"key": "allowed_file_types", "value": ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.txt", "type": "str", "group": "chat", "description": "Разрешенные типы файлов", "is_public": True},
        {"key": "chat_rate_limit", "value": "60", "type": "int", "group": "chat", "description": "Лимит сообщений в минуту", "is_public": False},
        {"key": "chat_max_message_length", "value": "4000", "type": "int", "group": "chat", "description": "Максимальная длина сообщения", "is_public": True},
        {"key": "chat_allow_delete", "value": "true", "type": "bool", "group": "chat", "description": "Разрешить удаление сообщений", "is_public": True},
        {"key": "chat_allow_create_channel", "value": "true", "type": "bool", "group": "chat", "description": "Разрешить создание каналов", "is_public": True},
        {"key": "chat_page_size", "value": "50", "type": "int", "group": "chat", "description": "Количество сообщений на странице", "is_public": True},
    ]

    for s_data in default_settings:
        result = await session.execute(select(SystemSetting).where(SystemSetting.key == s_data["key"]))
        if not result.scalar_one_or_none():
            setting = SystemSetting(
                key=s_data["key"],
                value=s_data["value"],
                type=s_data["type"],
                group=s_data["group"],
                description=s_data["description"],
                is_public=s_data["is_public"]
            )
            session.add(setting)

    await session.commit()


async def seed_default_units(session: AsyncSession) -> dict:
    """Create default organizational units and return mapping"""
    default_units = ["Управление", "Служба связи", "Штаб", "Разведка", "Медслужба"]
    units_map = {}

    for unit_name in default_units:
        result = await session.execute(select(Unit).where(Unit.name == unit_name))
        unit = result.scalar_one_or_none()
        if not unit:
            unit = Unit(name=unit_name, description=f"Подразделение {unit_name}")
            session.add(unit)
            await session.flush()
        units_map[unit_name] = unit.id

    return units_map


async def seed_test_users(session: AsyncSession, units_map: dict) -> None:
    """Create default test users"""
    test_users_data = [
        {
            "username": "admin",
            "email": "admin@sentinel.com",
            "full_name": "Главный Администратор",
            "role": "admin",
            "unit": "Управление",
            "cabinet": "01",
            "phone_number": "00"
        },
        {
            "username": "ivanov",
            "email": "ivanov@sentinel.com",
            "full_name": "Иванов Иван Иванович",
            "role": "user",
            "unit": "Служба связи",
            "cabinet": "101",
            "phone_number": "10-21"
        },
        {
            "username": "petrov",
            "email": "petrov@sentinel.com",
            "full_name": "Петров Петр Петрович",
            "role": "user",
            "unit": "Штаб",
            "cabinet": "205",
            "phone_number": "12-44"
        },
        {
            "username": "sidorov",
            "email": "sidorov@sentinel.com",
            "full_name": "Сидоров Алексей Сергеевич",
            "role": "user",
            "unit": "Разведка",
            "cabinet": "312",
            "phone_number": "15-01"
        },
        {
            "username": "smirnova",
            "email": "smirnova@sentinel.com",
            "full_name": "Смирнова Мария Викторовна",
            "role": "user",
            "unit": "Медслужба",
            "cabinet": "Медпункт",
            "phone_number": "11-03"
        },
        {
            "username": "kuznetsov",
            "email": "kuznetsov@sentinel.com",
            "full_name": "Кузнецов Дмитрий Олегович",
            "role": "admin",
            "unit": "Управление",
            "cabinet": "Главный корпус",
            "phone_number": "01"
        },
        {
            "username": "telegraf",
            "email": "telegraf@40919.com",
            "full_name": "Телеграфист (Экспедитор)",
            "role": "operator",
            "unit": "Служба связи",
            "cabinet": "Аппаратная",
            "phone_number": "99"
        }
    ]

    for u_data in test_users_data:
        result = await session.execute(select(User).where(User.username == u_data["username"]))
        if not result.scalar_one_or_none():
            new_user = User(
                username=u_data["username"],
                email=u_data["email"],
                hashed_password=get_password_hash("test123"),
                full_name=u_data["full_name"],
                role=u_data["role"],
                unit_id=units_map.get(u_data["unit"]),
                cabinet=u_data.get("cabinet"),
                phone_number=u_data.get("phone_number")
            )
            session.add(new_user)

    await session.commit()


async def main():
    """Main seeding function"""
    print("🌱 Starting database seeding...")

    async with AsyncSessionLocal() as session:
        try:
            await cleanup_duplicate_channel_memberships(session)
            print("✅ Cleaned duplicate channel memberships")

            await seed_system_settings(session)
            print("✅ Seeded system settings")

            units_map = await seed_default_units(session)
            print(f"✅ Seeded {len(units_map)} organizational units")

            await seed_test_users(session, units_map)
            print("✅ Seeded test users")

            print("🎉 Database seeding completed successfully!")
        except Exception as e:
            print(f"❌ Error during seeding: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
