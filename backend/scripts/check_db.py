import asyncio
import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import AsyncSessionLocal, init_db
from sqlalchemy import select
from app.modules.auth.models import User

async def check_db_emails():
    await init_db()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        print(f"--- Database Users ---")
        for user in users:
            print(f"Username: {user.username:20} Email: {user.email}")
        print(f"----------------------")

if __name__ == "__main__":
    asyncio.run(check_db_emails())
