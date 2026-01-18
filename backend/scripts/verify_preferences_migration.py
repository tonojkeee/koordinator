import asyncio
import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import init_db, engine
from sqlalchemy import text

async def verify():
    print("Running init_db...")
    await init_db()
    
    print("Checking for preferences column...")
    async with engine.connect() as conn:
        result = await conn.execute(text("PRAGMA table_info(users)"))
        columns = [row.name for row in result.fetchall()]
        
        if "preferences" in columns:
            print("SUCCESS: preferences column exists!")
        else:
            print("FAILURE: preferences column NOT found!")
            print(f"Columns found: {columns}")

if __name__ == "__main__":
    asyncio.run(verify())
