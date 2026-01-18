"""
Celery background tasks.

This module contains all background tasks that can be offloaded
from the main request/response cycle.
"""
import logging
import os
import asyncio
from datetime import datetime, timedelta
from celery import shared_task

from typing import Any, Coroutine


logger = logging.getLogger(__name__)


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """Helper to run async code in sync Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_incoming_email(self, email_data: dict) -> None:
    """
    Process incoming email in background.
    
    Args:
        email_data: Dict containing email fields (from, to, subject, body, etc.)
    """
    async def _process() -> None:
        from app.core.database import AsyncSessionLocal
        from app.modules.email.service import EmailService
        
        async with AsyncSessionLocal() as db:
            try:
                await EmailService.create_email_from_data(db, email_data)
                logger.info(f"Processed email: {email_data.get('subject', 'No subject')}")
            except Exception as e:
                logger.error(f"Failed to process email: {e}")
                raise
                
    try:
        run_async(_process())
    except Exception as e:
        logger.error(f"Email processing failed: {e}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3)
def cleanup_user_files(self, user_id: int) -> int:
    """
    Delete all files associated with a user in background.
    Called after user deletion to avoid blocking the request.
    
    Args:
        user_id: ID of the deleted user
    """
    async def _cleanup() -> int:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import select
        from app.modules.archive.models import ArchiveFile
        from app.modules.board.models import Document
        
        deleted_count = 0
        
        async with AsyncSessionLocal() as db:
            # Delete archive files
            files = await db.execute(
                select(ArchiveFile).where(ArchiveFile.owner_id == user_id)
            )
            for file in files.scalars().all():
                if os.path.exists(file.file_path):
                    try:
                        os.remove(file.file_path)
                        deleted_count += 1
                    except Exception as e:
                        logger.error(f"Failed to delete file {file.file_path}: {e}")
                        
            # Delete documents
            docs = await db.execute(
                select(Document).where(Document.owner_id == user_id)
            )
            for doc in docs.scalars().all():
                if os.path.exists(doc.file_path):
                    try:
                        os.remove(doc.file_path)
                        deleted_count += 1
                    except Exception as e:
                        logger.error(f"Failed to delete doc {doc.file_path}: {e}")
                        
        logger.info(f"Cleaned up {deleted_count} files for user {user_id}")
        return deleted_count
        
    try:
        return run_async(_cleanup())
    except Exception as e:
        logger.error(f"User file cleanup failed: {e}")
        raise self.retry(exc=e)


@shared_task
def cleanup_expired_sessions() -> None:
    """
    Periodic task to clean up expired data.
    Runs every hour via Celery Beat.
    """
    async def _cleanup() -> None:
        from app.core.database import AsyncSessionLocal
        from app.core.redis_manager import redis_manager
        
        logger.info("Running scheduled session cleanup...")
        
        # Clean up stale Redis session data
        if redis_manager.is_available:
            sessions = await redis_manager.get_all_session_starts()
            cutoff = datetime.utcnow() - timedelta(days=7)
            
            expired_count = 0
            for user_id, start_time in sessions.items():
                if start_time < cutoff:
                    await redis_manager.clear_session_start(user_id)
                    expired_count += 1
                    
            logger.info(f"Cleaned up {expired_count} expired sessions")
            
    run_async(_cleanup())


@shared_task(bind=True, max_retries=3)
def send_notification_email(self, user_id: int, subject: str, body: str) -> None:
    """
    Send notification email to user in background.
    
    Args:
        user_id: Target user ID
        subject: Email subject
        body: Email body (HTML)
    """
    async def _send() -> None:
        from app.core.database import AsyncSessionLocal
        from app.modules.auth.service import UserService
        import aiosmtplib
        from email.message import EmailMessage
        
        async with AsyncSessionLocal() as db:
            user = await UserService.get_user_by_id(db, user_id)
            if not user or not user.email:
                logger.warning(f"Cannot send email to user {user_id}: no email")
                return
                
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = "noreply@koordinator.local"
            msg["To"] = user.email
            msg.set_content(body, subtype="html")
            
            # In production, configure SMTP settings
            # For now, just log
            logger.info(f"Would send email to {user.email}: {subject}")
            
    try:
        run_async(_send())
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        raise self.retry(exc=e)
