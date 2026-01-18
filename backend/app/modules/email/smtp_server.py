import logging
from aiosmtpd.controller import Controller
from app.core.database import AsyncSessionLocal
from app.modules.email.service import process_incoming_email

logger = logging.getLogger(__name__)

class DatabaseHandler:
    async def handle_DATA(self, server, session, envelope):
        sender = envelope.mail_from
        recipients = envelope.rcpt_tos
        content = envelope.content  # Bytes
        
        logger.info(f"Receiving email from {sender} to {recipients}")
        
        try:
            # We need a new DB session for this operation
            async with AsyncSessionLocal() as db:
                await process_incoming_email(db, sender, recipients, content)
            return '250 OK'
        except Exception as e:
            logger.error(f"Error processing incoming email: {e}")
            return '500 Internal Server Error'

class SMTPServerManager:
    def __init__(self, hostname='0.0.0.0', port=2525): 
        # Using 2525 by default to avoid permission issues if not root, 
        # though user asked for "like a server", often needs 25. 
        # We can map 25->2525 via docker or iptables, or run as root (not recommended).
        # Let's verify with user or assume high port for dev.
        self.hostname = hostname
        self.port = port
        self.controller = None

    def start(self):
        handler = DatabaseHandler()
        self.controller = Controller(handler, hostname=self.hostname, port=self.port)
        self.controller.start()
        logger.info(f"SMTP Server started on {self.hostname}:{self.port}")

    def stop(self):
        if self.controller:
            self.controller.stop()
            logger.info("SMTP Server stopped")
