import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)

async def check_db(db_path):
    print(f"\nChecking database: {db_path}")
    if not os.path.exists(db_path):
        print("File does not exist.")
        return
    
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    
    try:
        async with async_session() as session:
            result = await session.execute(select(User))
            users = result.scalars().all()
            for user in users:
                print(f"  {user.username:20} -> {user.email}")
    except Exception as e:
        print(f"  Error reading DB: {e}")
    finally:
        await engine.dispose()

async def main():
    await check_db("teamchat.db")
    await check_db("backend/teamchat.db")

if __name__ == "__main__":
    asyncio.run(main())
