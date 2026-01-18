from sqlalchemy import select, update, desc
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
import bleach

from app.modules.email.models import EmailMessage, EmailAccount, EmailAttachment, EmailFolder
from app.modules.email.schemas import EmailMessageCreate, EmailMessageUpdate, EmailFolderCreate
from app.modules.auth.models import User

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
    stmt = select(EmailMessage).where(EmailMessage.account_id == account_id)
    
    if folder == "inbox":
        stmt = stmt.where(EmailMessage.is_sent == False, EmailMessage.is_deleted == False, EmailMessage.is_archived == False)
    elif folder == "sent":
        stmt = stmt.where(EmailMessage.is_sent == True, EmailMessage.is_deleted == False)
    elif folder == "trash":
        stmt = stmt.where(EmailMessage.is_deleted == True)
    elif folder == "archive":
        stmt = stmt.where(EmailMessage.is_archived == True, EmailMessage.is_deleted == False)
    elif folder == "starred":
        stmt = stmt.where(EmailMessage.is_starred == True, EmailMessage.is_deleted == False)
    elif folder == "important":
        stmt = stmt.where(EmailMessage.is_important == True, EmailMessage.is_deleted == False)
    else:
        # Assume it's a custom folder ID
        try:
            f_id = int(folder)
            stmt = stmt.where(EmailMessage.folder_id == f_id, EmailMessage.is_deleted == False)
        except ValueError:
            pass
            
    stmt = stmt.order_by(desc(EmailMessage.received_at)).offset(skip).limit(limit).options(selectinload(EmailMessage.attachments))
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_email_by_id(db: AsyncSession, message_id: int, account_id: int) -> Optional[EmailMessage]:
    stmt = select(EmailMessage).where(
        EmailMessage.id == message_id,
        EmailMessage.account_id == account_id
    ).options(selectinload(EmailMessage.attachments))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

from app.modules.admin.service import SystemSettingService

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
    # ... (omitted for brevity, no changes needed here as it was empty/placeholder)

    # 4. Construct Python Email Object
    msg = MIMEMultipart("alternative")
    msg["Subject"] = email_data.subject
    msg["From"] = account.email_address
    msg["To"] = email_data.to_address
    if email_data.cc_address:
        msg["Cc"] = email_data.cc_address
    
    if email_data.body_text:
        part1 = MIMEText(email_data.body_text, "plain")
        msg.attach(part1)
    if email_data.body_html:
        part2 = MIMEText(email_data.body_html, "html")
        msg.attach(part2)

    # 5. Send via aiosmtplib
    smtp_host = await SystemSettingService.get_value(db, "email_smtp_host", "127.0.0.1")
    smtp_port = await SystemSettingService.get_value(db, "email_smtp_port", 2525)
    
    try:
        async with aiosmtplib.SMTP(hostname=smtp_host, port=int(smtp_port)) as smtp:
            await smtp.send_message(msg)
            
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
                    body_text += part.get_content()
                except (UnicodeDecodeError, LookupError, ValueError) as e:
                    logger.warning(f"Failed to decode text/plain part: {e}")
                    pass
            elif ctype == "text/html" and "attachment" not in cdispo:
                try:
                    raw_html = part.get_content()
                    body_html += sanitize_html(raw_html)
                except (UnicodeDecodeError, LookupError, ValueError) as e:
                    logger.warning(f"Failed to decode text/html part: {e}")
                    pass
    else:
        try:
            body_text = msg.get_content()
        except (UnicodeDecodeError, LookupError, ValueError) as e:
            logger.warning(f"Failed to decode message content: {e}")
            pass
    
    return body_text, body_html


async def _get_attachment_settings(db: AsyncSession) -> tuple[int, int, set]:
    """Get attachment validation settings from database"""
    max_mb_str = await SystemSettingService.get_value(db, "email_max_attachment_size_mb", "25")
    max_total_mb_str = await SystemSettingService.get_value(db, "email_max_total_attachment_size_mb", "50")
    allowed_types_str = await SystemSettingService.get_value(db, "email_allowed_file_types", "")
    
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


async def _find_or_create_email_account(
    db: AsyncSession, 
    recipient: str
) -> Optional[EmailAccount]:
    """Find existing email account or auto-create if internal user"""
    clean_recipient = recipient.strip()
    if "<" in clean_recipient:
        clean_recipient = clean_recipient.split("<")[1].split(">")[0]
        
    stmt = select(EmailAccount).where(EmailAccount.email_address == clean_recipient)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    
    if not account:
        try:
            from app.core.config import get_settings
            settings = get_settings()
            username = clean_recipient.split("@")[0]
            stmt_user = select(User).where(User.username == username)
            res_user = await db.execute(stmt_user)
            user = res_user.scalar_one_or_none()
            if user and clean_recipient.endswith(f"@{settings.internal_email_domain}"):
                account = EmailAccount(user_id=user.id, email_address=clean_recipient)
                db.add(account)
                await db.flush()
                logger.info(f"Auto-created email account for recipient: {clean_recipient}")
        except Exception as e:
            logger.error(f"Failed to auto-create account for {clean_recipient}: {e}")
    
    return account


async def _save_email_attachments(
    db: AsyncSession,
    msg,
    message_id: int,
    max_bytes: int,
    max_total_bytes: int,
    allowed_exts: set
):
    """Extract and save email attachments"""
    current_total_size = 0
    if not msg.is_multipart():
        return
    
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get("Content-Disposition") is None:
            continue
            
        filename = part.get_filename()
        if not filename:
            continue
        
        ext = os.path.splitext(filename)[1].lower()
        if allowed_exts and ext not in allowed_exts:
            logger.warning(f"Skipping attachment {filename}: type {ext} not allowed")
            continue
            
        file_data = part.get_payload(decode=True)
        if not file_data:
            continue
        
        file_size = len(file_data)
        if file_size > max_bytes:
            logger.warning(f"Skipping attachment {filename}: size {file_size} > {max_bytes}")
            continue
            
        if current_total_size + file_size > max_total_bytes:
            logger.warning(f"Skipping attachment {filename}: total size {current_total_size + file_size} > {max_total_bytes}")
            continue

        current_total_size += file_size
        unique_name = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)
        
        with open(file_path, "wb") as f:
            f.write(file_data)
            
        att = EmailAttachment(
            message_id=message_id,
            filename=filename,
            content_type=part.get_content_type(),
            file_size=len(file_data),
            file_path=file_path
        )
        db.add(att)


async def process_incoming_email(
    db: AsyncSession,
    sender: str,
    recipients: List[str],
    content: bytes,
):
    """
    Parses raw email bytes and saves to DB for each local recipient.
    """
    import email
    from email.policy import default
    
    msg = email.message_from_bytes(content, policy=default)
    subject = msg.get("subject", "(No Subject)")
    body_text, body_html = await _extract_email_body(msg)
    max_bytes, max_total_bytes, allowed_exts = await _get_attachment_settings(db)

    # Batch load or create email accounts to avoid N+1 queries
    clean_recipients = []
    for recipient in recipients:
        clean_recipient = recipient.strip()
        if "<" in clean_recipient:
            clean_recipient = clean_recipient.split("<")[1].split(">")[0]
        clean_recipients.append(clean_recipient)
    
    # Load all existing accounts at once
    stmt = select(EmailAccount).where(EmailAccount.email_address.in_(clean_recipients))
    result = await db.execute(stmt)
    accounts_dict = {acc.email_address: acc for acc in result.scalars().all()}
    
    # Create missing accounts for internal users
    from app.core.config import get_settings
    settings = get_settings()
    
    for clean_recipient in clean_recipients:
        if clean_recipient not in accounts_dict:
            try:
                username = clean_recipient.split("@")[0]
                stmt_user = select(User).where(User.username == username)
                res_user = await db.execute(stmt_user)
                user = res_user.scalar_one_or_none()
                if user and clean_recipient.endswith(f"@{settings.internal_email_domain}"):
                    account = EmailAccount(user_id=user.id, email_address=clean_recipient)
                    db.add(account)
                    await db.flush()
                    accounts_dict[clean_recipient] = account
                    logger.info(f"Auto-created email account for recipient: {clean_recipient}")
            except Exception as e:
                logger.error(f"Failed to auto-create account for {clean_recipient}: {e}")

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
        
        await _save_email_attachments(db, msg, db_msg.id, max_bytes, max_total_bytes, allowed_exts)
    
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

# --- Folders ---

async def get_folders(db: AsyncSession, account_id: int) -> List[EmailFolder]:
    stmt = select(EmailFolder).where(EmailFolder.account_id == account_id).order_by(EmailFolder.name)
    result = await db.execute(stmt)
    return result.scalars().all()

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
