import sys
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# Add backend directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import get_settings

async def verify():
    settings = get_settings()
    print(f"Database URL: {settings.database_url}")
    
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
    print(f"Resolved DB Path: {db_path}")
    
    if os.path.exists(db_path):
        print("SUCCESS: Database file exists.")
    else:
        print("ERROR: Database file does not exist!")
        sys.exit(1)

    # Try connecting
    try:
        engine = create_async_engine(settings.database_url)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"Connection test: {result.scalar()}")
        print("SUCCESS: Connected to database.")
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(verify())
