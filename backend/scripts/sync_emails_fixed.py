import asyncio
import sys
import os
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, ForeignKey

# Sync script for the active database
# This script is in backend/scripts/
# DB is in backend/teamchat.db
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_backend_dir, "teamchat.db")

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)

class EmailAccount(Base):
    __tablename__ = "email_accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    email_address: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

async def sync_database():
    print(f"Syncing database: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Error: Database file not found.")
        return

    engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}")
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    domain = "40919.com"

    async with async_session() as session:
        # 1. Update User emails
        result = await session.execute(select(User))
        users = result.scalars().all()
        
        for user in users:
            new_email = f"{user.username}@{domain}"
            if user.email != new_email:
                print(f"Updating user {user.username}: {user.email} -> {new_email}")
                user.email = new_email
        
        await session.flush()

        # 2. Update/Create EmailAccount entries
        for user in users:
            stmt = select(EmailAccount).where(EmailAccount.user_id == user.id)
            res = await session.execute(stmt)
            acc = res.scalar_one_or_none()
            
            new_email = f"{user.username}@{domain}"
            if acc:
                if acc.email_address != new_email:
                    print(f"Updating EmailAccount for {user.username}: {acc.email_address} -> {new_email}")
                    acc.email_address = new_email
            else:
                print(f"Creating EmailAccount for {user.username}: {new_email}")
                new_acc = EmailAccount(
                    user_id=user.id, 
                    email_address=new_email,
                    created_at=datetime.utcnow()
                )
                session.add(new_acc)

        await session.commit()
        print("Sync complete.")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(sync_database())
