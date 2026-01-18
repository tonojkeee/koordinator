import asyncio
import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import AsyncSessionLocal, init_db
from sqlalchemy import select
from app.modules.auth.models import User
from app.modules.email.models import EmailAccount

async def check_all_emails():
    await init_db()
    async with AsyncSessionLocal() as db:
        # Check User table
        result_users = await db.execute(select(User))
        users = result_users.scalars().all()
        
        print(f"--- Users table ---")
        for user in users:
            print(f"Username: {user.username:20} Email: {user.email}")
        print()
        
        # Check EmailAccount table
        result_accounts = await db.execute(select(EmailAccount))
        accounts = result_accounts.scalars().all()
        
        print(f"--- EmailAccount table ---")
        for acc in accounts:
            print(f"User ID: {acc.user_id:<5} Address: {acc.email_address}")
        print(f"--------------------------")

if __name__ == "__main__":
    asyncio.run(check_all_emails())
