from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from sqlalchemy import select
from app.core.config import get_settings
from typing import AsyncGenerator


import logging

logger = logging.getLogger(__name__)

settings = get_settings()


def create_engine_with_pool() -> AsyncEngine:
    """
    Create database engine with appropriate connection pooling.
    
    - SQLite: Uses NullPool (no pooling, single connection)
    - MySQL/PostgreSQL: Uses QueuePool with configurable size
    """
    common_args = {
        "echo": settings.debug,
        "future": True,
    }
    
    if settings.is_sqlite:
        # SQLite doesn't support connection pooling well
        # Use NullPool to create new connection each time
        logger.info("Database: Using SQLite with NullPool")
        return create_async_engine(
            settings.database_url,
            poolclass=NullPool,
            **common_args
        )
    else:
        # MySQL/PostgreSQL - use connection pooling
        logger.info(
            f"Database: Using connection pool "
            f"(size={settings.db_pool_size}, overflow={settings.db_max_overflow})"
        )
        return create_async_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_recycle=settings.db_pool_recycle,
            pool_pre_ping=True,  # Check connection health before use
            **common_args
        )


# Create async engine with appropriate pooling
engine = create_engine_with_pool()

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)



class Base(DeclarativeBase):
    """Base class for all models"""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database sessions"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def _cleanup_duplicate_channel_memberships(session: AsyncSession) -> None:
    """Remove duplicate channel memberships to allow UniqueConstraint"""
    from sqlalchemy import delete, func
    from app.modules.chat.models import ChannelMember
    
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


async def _seed_system_settings(session: AsyncSession) -> None:
    """Create default system settings if they don't exist"""
    from app.modules.admin.models import SystemSetting
    
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


async def _seed_default_units(session: AsyncSession) -> dict:
    """Create default organizational units and return mapping"""
    from app.modules.auth.models import Unit
    
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


async def _seed_test_users(session: AsyncSession, units_map: dict) -> None:
    """Create default test users"""
    from app.modules.auth.models import User
    from app.core.security import get_password_hash
    
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


async def init_db() -> None:
    """Initialize database - create all tables and default content"""
    # Import all models here so they register with Base.metadata
    import app.modules.auth.models # noqa
    import app.modules.chat.models # noqa
    import app.modules.board.models # noqa
    import app.modules.archive.models # noqa
    import app.modules.admin.models # noqa
    import app.modules.tasks.models # noqa
    import app.modules.email.models # noqa
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise
    
    try:
        async with AsyncSessionLocal() as session:
            await _cleanup_duplicate_channel_memberships(session)
            await _seed_system_settings(session)
            units_map = await _seed_default_units(session)
            await _seed_test_users(session, units_map)
    except Exception as e:
        logger.error(f"Failed to seed database with default data: {e}")
        raise


