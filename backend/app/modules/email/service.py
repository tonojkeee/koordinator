from sqlalchemy import select, update, desc, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from typing import List, Optional
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import uuid
import logging
from datetime import datetime
from pathlib import Path
import bleach

from app.modules.email.models import EmailMessage, EmailAccount, EmailAttachment, EmailFolder
from app.modules.email.schemas import EmailMessageCreate, EmailMessageUpdate, EmailFolderCreate
from app.modules.auth.models import User
from email import message_from_bytes, encoders
from email.header import decode_header

logger = logging.getLogger(__name__)

# Configuration (In a real app, these should be in settings)
UPLOAD_DIR = "uploads/email_attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# HTML sanitization configuration
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
    'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'tr', 'td', 'th', 'thead', 'tbody', 'div', 'span'
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    '*': ['class']
}


def sanitize_html(html: str) -> str:
    """
    Sanitize HTML content to prevent XSS attacks.
    Removes dangerous tags and attributes while preserving safe formatting.
    """
    if not html:
        return html

    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )


async def get_user_email_account(db: AsyncSession, user_id: int) -> Optional[EmailAccount]:
    result = await db.execute(select(EmailAccount).where(EmailAccount.user_id == user_id))
    return result.scalar_one_or_none()

async def create_email_account(db: AsyncSession, user_id: int, email_address: str) -> EmailAccount:
    account = EmailAccount(user_id=user_id, email_address=email_address)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account

async def get_emails(
    db: AsyncSession,
    account_id: int,
    folder: str = "inbox",
    skip: int = 0,
    limit: int = 50
) -> List[EmailMessage]:
    if folder == "inbox":
        stmt = select(EmailMessage).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_sent == False,
                EmailMessage.is_deleted == False,
                EmailMessage.folder_id.is_(None)
            )
        )
    elif folder == "sent":
        stmt = select(EmailMessage).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_sent == True,
                EmailMessage.is_deleted == False
            )
        )
    elif folder == "trash":
        stmt = select(EmailMessage).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_deleted == True
            )
        )
    elif folder == "archive":
        stmt = select(EmailMessage).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_archived == True,
                EmailMessage.is_deleted == False
            )
        )
    elif folder == "starred":
        stmt = select(EmailMessage).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_starred == True,
                EmailMessage.is_deleted == False
            )
        )
    elif folder == "important":
        stmt = select(EmailMessage).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_important == True,
                EmailMessage.is_deleted == False
            )
        )
    else:
        # Assume it's a custom folder ID
        try:
            f_id = int(folder)
            stmt = select(EmailMessage).where(
                and_(
                    EmailMessage.account_id == account_id,
                    EmailMessage.folder_id == f_id,
                    EmailMessage.is_deleted == False
                )
            )
        except ValueError:
            return []

    stmt = stmt.order_by(desc(EmailMessage.received_at)).offset(skip).limit(limit).options(selectinload(EmailMessage.attachments))
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def get_email_attachment(db: AsyncSession, attachment_id: int, user_id: int) -> Optional[EmailAttachment]:
    """Get email attachment and verify ownership"""
    stmt = select(EmailAttachment).where(EmailAttachment.id == attachment_id)
    result = await db.execute(stmt)
    attachment = result.scalar_one_or_none()

    if not attachment:
        return None

    # Get the message to find the account
    stmt_message = select(EmailMessage).where(EmailMessage.id == attachment.message_id).options(selectinload(EmailMessage.attachments))
    result_message = await db.execute(stmt_message)
    message = result_message.scalar_one_or_none()

    if not message:
        return None

    # Get account associated with message
    account = await get_user_email_account(db, user_id)
    if not account or message.account_id != account.id:
        return None

    return attachment

async def get_email_by_id(db: AsyncSession, message_id: int, account_id: Optional[int]) -> Optional[EmailMessage]:
    stmt = select(EmailMessage).where(EmailMessage.id == message_id).options(selectinload(EmailMessage.attachments))
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()

    # Verify ownership if account_id is provided
    if account_id is not None and message and message.account_id != account_id:
        return None

    return message

from app.core.config_service import ConfigService

async def send_email(db: AsyncSession, account_id: int, email_data: EmailMessageCreate, files: List[tuple] = []) -> EmailMessage:
    # 1. Fetch sender account
    account = await db.get(EmailAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")

    # 2. Create Email Message in DB (Sent folder)
    db_message = EmailMessage(
        account_id=account_id,
        subject=email_data.subject,
        from_address=account.email_address,
        to_address=email_data.to_address,
        cc_address=email_data.cc_address,
        bcc_address=email_data.bcc_address,
        body_text=email_data.body_text,
        body_html=email_data.body_html,
        is_sent=True,
        is_read=True
    )
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)

    # 3. Handle Attachments
    from email.mime.multipart import MIMEMultipart

    smtp_msg = MIMEMultipart("mixed")
    smtp_msg["Subject"] = email_data.subject
    smtp_msg["From"] = account.email_address
    smtp_msg["To"] = email_data.to_address
    if email_data.cc_address:
        smtp_msg["Cc"] = email_data.cc_address
    if email_data.bcc_address:
        smtp_msg["Bcc"] = email_data.bcc_address

    if email_data.body_text:
        part_text = MIMEText(email_data.body_text, "plain")
        smtp_msg.attach(part_text)
    if email_data.body_html:
        part_html = MIMEText(email_data.body_html, "html")
        smtp_msg.attach(part_html)

    for filename, content, content_type in files:
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = Path(UPLOAD_DIR) / unique_filename

        try:
            with open(file_path, "wb") as f:
                f.write(content)

            attachment = EmailAttachment(
                message_id=db_message.id,
                file_name=filename,
                file_path=str(file_path),
                file_size=len(content)
            )
            db.add(attachment)

            # Add to email message
            from email.mime.base import MIMEBase
            part = MIMEBase(*content_type.split('/', 1) if '/' in content_type else ('application', 'octet-stream'))
            part.set_payload(content)
            import email.encoders
            email.encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
            smtp_msg.attach(part)

        except Exception as e:
            logger.error(f"Failed to save attachment {filename}: {e}")

    await db.flush()

    # 4. Send via aiosmtplib
    smtp_host = await ConfigService.get_value(db, "email_smtp_host", "127.0.0.1")
    smtp_port = await ConfigService.get_value(db, "email_smtp_port", "2525")

    try:
        async with aiosmtplib.SMTP(hostname=smtp_host, port=int(smtp_port)) as smtp:
            await smtp.send_message(smtp_msg)

        logger.info(f"Email sent via SMTP ({smtp_host}:{smtp_port}) to {email_data.to_address}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        # Note: Message is already saved as Sent. We might want to mark as failed later.

    # Re-fetch with attachments to avoid MissingGreenlet on response serialization
    stmt = select(EmailMessage).where(EmailMessage.id == db_message.id).options(selectinload(EmailMessage.attachments))
    result = await db.execute(stmt)
    db_message = result.scalar_one()

    return db_message

# --- Incoming Email Processing ---

async def _extract_email_body(msg) -> tuple[str, str]:
    """Extract plain text and HTML body from email message"""
    body_text = ""
    body_html = ""

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdispo = str(part.get("Content-Disposition"))

            if ctype == "text/plain" and "attachment" not in cdispo:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_text += payload.decode('utf-8', errors='ignore')
                except (UnicodeDecodeError, LookupError, ValueError) as e:
                    logger.warning(f"Failed to decode text/plain part: {e}")
                    pass
            elif ctype == "text/html" and "attachment" not in cdispo:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_html += sanitize_html(payload.decode('utf-8', errors='ignore'))
                except (UnicodeDecodeError, LookupError, ValueError) as e:
                    logger.warning(f"Failed to decode text/html part: {e}")
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body_text = payload.decode('utf-8', errors='ignore')
        except (UnicodeDecodeError, LookupError, ValueError) as e:
            logger.warning(f"Failed to decode message content: {e}")
            pass

    return body_text, body_html


async def _get_attachment_settings(db: AsyncSession) -> tuple[int, int, set]:
    """Get attachment validation settings from database"""
    max_mb_str = await ConfigService.get_value(db, "email_max_attachment_size_mb", "25")
    max_total_mb_str = await ConfigService.get_value(db, "email_max_total_attachment_size_mb", "50")
    allowed_types_str = await ConfigService.get_value(db, "email_allowed_file_types", "")
    
    try:
        max_bytes = int(max_mb_str) * 1024 * 1024
        max_total_bytes = int(max_total_mb_str) * 1024 * 1024
    except (ValueError, TypeError):
        max_bytes = 25 * 1024 * 1024
        max_total_bytes = 50 * 1024 * 1024
        
    allowed_exts = set()
    if allowed_types_str:
        allowed_exts = {t.strip().lower() for t in allowed_types_str.split(",")}
    
    return max_bytes, max_total_bytes, allowed_exts


async def _save_email_attachments(
    db: AsyncSession,
    msg,
    message_id: int,
    max_bytes: int,
    max_total_bytes: int,
    allowed_exts: set
) -> None:
    """Save email attachments to disk and database"""
    from pathlib import Path

    total_size = 0

    if msg.is_multipart():
        for part in msg.walk():
            cdispo = str(part.get("Content-Disposition"))

            if "attachment" in cdispo or "filename" in cdispo:
                filename = part.get_filename()
                if not filename:
                    continue

                # Check file extension
                ext = Path(filename).suffix.lower()
                if allowed_exts and ext not in allowed_exts:
                    logger.warning(f"Skipping attachment with disallowed extension: {filename}")
                    continue

                # Get file content and size
                try:
                    content = part.get_content()
                    file_size = len(content)
                except Exception as e:
                    logger.warning(f"Failed to decode attachment {filename}: {e}")
                    continue

                # Check size limits
                if file_size > max_bytes:
                    logger.warning(f"Skipping oversized attachment: {filename} ({file_size} bytes)")
                    continue

                if total_size + file_size > max_total_bytes:
                    logger.warning(f"Total attachment size exceeded, skipping: {filename}")
                    continue

                total_size += file_size

                # Generate unique filename
                unique_filename = f"{uuid.uuid4()}_{filename}"
                file_path = Path(UPLOAD_DIR) / unique_filename

                # Save to disk
                try:
                    with open(file_path, "wb") as f:
                        f.write(content)
                except Exception as e:
                    logger.error(f"Failed to save attachment {filename}: {e}")
                    continue

                # Create database record
                attachment = EmailAttachment(
                    message_id=message_id,
                    file_name=filename,
                    file_path=str(file_path),
                    file_size=file_size
                )
                db.add(attachment)

    await db.flush()


async def _find_or_create_email_account(
    db: AsyncSession,
    recipient: str,
    accounts_dict: dict
) -> Optional[EmailAccount]:
    """Find existing email account or auto-create if internal user"""
    clean_recipient = recipient.strip()
    if "<" in clean_recipient:
        clean_recipient = clean_recipient.split("<")[1].split(">")[0]

    # Check if already processed
    if clean_recipient in accounts_dict:
        return accounts_dict[clean_recipient]

    stmt = select(EmailAccount).where(EmailAccount.email_address == clean_recipient)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        try:
            from app.core.config_service import ConfigService
            username = clean_recipient.split("@")[0]
            stmt_user = select(User).where(User.username == username)
            res_user = await db.execute(stmt_user)
            user = res_user.scalar_one_or_none()
            email_domain = await ConfigService.get_value(db, "internal_email_domain", "40919.com")
            if user and clean_recipient.endswith(f"@{email_domain}"):
                account = EmailAccount(user_id=user.id, email_address=clean_recipient)
                db.add(account)
                await db.flush()
                accounts_dict[clean_recipient] = account
                logger.info(f"Auto-created email account for recipient: {clean_recipient}")
        except Exception as e:
            logger.error(f"Failed to auto-create account for {clean_recipient}: {e}")

    if account:
        accounts_dict[clean_recipient] = account

    return account


async def process_incoming_email(
    db: AsyncSession,
    sender: str,
    recipients: List[str],
    content: bytes
) -> None:
    """Process incoming email from SMTP server and save to database"""
    # Parse email message
    email_msg = message_from_bytes(content)

    # Extract subject
    subject = email_msg.get("Subject", "")
    if subject:
        subject, charset = decode_header(subject)[0]
        if isinstance(subject, bytes):
            subject = subject.decode(charset or "utf-8", errors="ignore")

    # Clean sender address
    if "<" in sender:
        sender = sender.split("<")[1].split(">")[0]

    # Extract body
    body_text, body_html = await _extract_email_body(email_msg)

    # Get attachment settings
    max_bytes, max_total_bytes, allowed_exts = await _get_attachment_settings(db)

    # Find or create email accounts for recipients
    clean_recipients = []
    accounts_dict = {}

    for recipient in recipients:
        clean_recipient = recipient.strip()
        if "<" in clean_recipient:
            clean_recipient = clean_recipient.split("<")[1].split(">")[0]
        clean_recipients.append(clean_recipient)

        await _find_or_create_email_account(db, recipient, accounts_dict)

    # Create email messages for each recipient account
    for recipient, clean_recipient in zip(recipients, clean_recipients):
        account = accounts_dict.get(clean_recipient)
        if not account:
            continue

        db_msg = EmailMessage(
            account_id=account.id,
            subject=subject,
            from_address=sender,
            to_address=",".join(recipients),
            body_text=body_text,
            body_html=body_html,
            received_at=datetime.utcnow(),
            is_read=False
        )
        db.add(db_msg)
        await db.flush()

        await _save_email_attachments(db, email_msg, db_msg.id, max_bytes, max_total_bytes, allowed_exts)

    await db.commit()


async def update_email_message(db: AsyncSession, message_id: int, account_id: int, updates: EmailMessageUpdate) -> Optional[EmailMessage]:
    message = await get_email_by_id(db, message_id, account_id)
    if not message:
        return None

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(message, field, value)
    
    await db.commit()
    await db.refresh(message)
    return message

async def delete_email_message(db: AsyncSession, message_id: int, account_id: int):
    message = await get_email_by_id(db, message_id, account_id)
    if not message:
        return
    
    await db.delete(message)
    await db.commit()

    # --- Statistics ---

    async def get_folders(db: AsyncSession, account_id: int) -> List[EmailFolder]:
        stmt = select(EmailFolder).where(EmailFolder.account_id == account_id).order_by(EmailFolder.name)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def create_folder(db: AsyncSession, account_id: int, folder_data: EmailFolderCreate) -> EmailFolder:
        import re
        slug = re.sub(r'[^a-z0-9]+', '-', folder_data.name.lower()).strip('-')
        if not slug:
            slug = 'folder-' + str(uuid.uuid4())[:8]

        folder = EmailFolder(
            account_id=account_id,
            name=folder_data.name,
            slug=slug,
            is_system=False
        )
        db.add(folder)
        await db.commit()
        await db.refresh(folder)
        return folder

    # --- Folders ---

async def get_folders(db: AsyncSession, account_id: int) -> List[EmailFolder]:
    """Get all folders for account including unread counts"""
    from sqlalchemy import func

    stmt = select(EmailFolder, func.count(EmailMessage.id).label('count')).where(
        EmailFolder.account_id == account_id
    ).outerjoin(
        EmailMessage, 
        and_(
            EmailFolder.id == EmailMessage.folder_id,
            EmailMessage.is_deleted == False
        )
    ).group_by(EmailFolder.id)

    result = await db.execute(stmt)
    folders = []
    for folder_obj, count in result:
        folders.append(EmailFolder(
            id=folder_obj.id,
            account_id=folder_obj.account_id,
            name=folder_obj.name,
            slug=folder_obj.slug,
            is_system=folder_obj.is_system,
            unread_count=count if folder_obj.is_system else 0
        ))
    return folders


async def get_email_stats(db: AsyncSession, account_id: int) -> dict:
    """Get email statistics for account"""
    
    # Count inbox messages (not sent, not deleted, no folder)
    inbox_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_sent == False,
                EmailMessage.is_deleted == False,
                EmailMessage.folder_id.is_(None)
            )
        )
    )
    
    # Count sent messages
    sent_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_sent == True,
                EmailMessage.is_deleted == False
            )
        )
    )
    
    # Count trash messages
    trash_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_deleted == True
            )
        )
    )
    
    # Count archived messages
    archived_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_archived == True,
                EmailMessage.is_deleted == False
            )
        )
    )
    
    # Count starred messages
    starred_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_starred == True,
                EmailMessage.is_deleted == False
            )
        )
    )
    
    # Count important messages
    important_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_important == True,
                EmailMessage.is_deleted == False
            )
        )
    )
    
    # Count total messages (not deleted)
    total_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_deleted == False
            )
        )
    )
    
    # Count unread messages (only incoming, not sent)
    unread_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_read == False,
                EmailMessage.is_deleted == False,
                EmailMessage.is_sent == False  # Only count incoming messages
            )
        )
    )
    
    return {
        "inbox": inbox_count or 0,
        "sent": sent_count or 0,
        "important": important_count or 0,
        "starred": starred_count or 0,
        "archived": archived_count or 0,
        "trash": trash_count or 0,
        "total": total_count or 0,
        "unread": unread_count or 0
    }


async def create_folder(db: AsyncSession, account_id: int, folder_data: EmailFolderCreate) -> EmailFolder:
    # Generate slug
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', folder_data.name.lower()).strip('-')
    if not slug:
        slug = 'folder-' + str(uuid.uuid4())[:8]
        
    folder = EmailFolder(
        account_id=account_id,
        name=folder_data.name,
        slug=slug,
        is_system=False
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return folder

async def delete_folder(db: AsyncSession, folder_id: int, account_id: int):
    stmt = select(EmailFolder).where(EmailFolder.id == folder_id, EmailFolder.account_id == account_id)
    result = await db.execute(stmt)
    folder = result.scalar_one_or_none()
    if folder:
        # Before deleting folder, "unfolder" messages or move to inbox?
        # For simplicity, move to inbox (set folder_id to None)
        await db.execute(update(EmailMessage).where(EmailMessage.folder_id == folder_id).values(folder_id=None))
        await db.delete(folder)
        await db.commit()


async def get_unread_count(db: AsyncSession, account_id: int) -> dict:
    """Get total unread count for account (only incoming messages)"""
    unread_count = await db.scalar(
        select(func.count(EmailMessage.id)).where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_read == False,
                EmailMessage.is_deleted == False,
                EmailMessage.is_sent == False  # Only count incoming messages
            )
        )
    )
    return {"total": unread_count or 0}


async def mark_all_as_read(db: AsyncSession, account_id: int) -> dict:
    """Mark all unread incoming messages as read for account"""
    result = await db.execute(
        update(EmailMessage)
        .where(
            and_(
                EmailMessage.account_id == account_id,
                EmailMessage.is_read == False,
                EmailMessage.is_deleted == False,
                EmailMessage.is_sent == False  # Only mark incoming messages
            )
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"marked": result.rowcount}
