from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.modules.board.models import Document, DocumentShare
from app.modules.board.schemas import DocumentCreate

class BoardService:
    @staticmethod
    async def create_document(db: AsyncSession, doc_data: DocumentCreate, file_path: str, owner_id: int, file_size: Optional[int] = None) -> Document:
        document = Document(
            title=doc_data.title,
            description=doc_data.description,
            file_path=file_path,
            file_size=file_size,
            owner_id=owner_id
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document

    @staticmethod
    async def get_document_by_id(db: AsyncSession, doc_id: int) -> Optional[Document]:
        query = select(Document).options(selectinload(Document.owner)).where(Document.id == doc_id)
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def get_user_documents(db: AsyncSession, user_id: int) -> List[Document]:
        # Get documents owned by user OR shared with user
        # We might want to separate these or return them together. 
        # For simplicity, let's just return owned documents here, and maybe a separate method for shared?
        # Re-reading requirement: "users between each other must exchange documents".
        # So I probably want ot see documents I received.
        
        # Let's implementation:
        # 1. Owned documents
        # 2. Shared with me documents
        pass 

    @staticmethod
    async def get_owned_documents(db: AsyncSession, user_id: int) -> List[Document]:
        query = select(Document).options(selectinload(Document.owner)).where(Document.owner_id == user_id).order_by(Document.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_shared_with_me_documents(db: AsyncSession, user_id: int) -> List[DocumentShare]:
        from app.modules.auth.models import User
        from app.modules.chat.models import Message, Channel, ChannelMember
        
        query = select(DocumentShare).options(
            selectinload(DocumentShare.document).selectinload(Document.owner).selectinload(User.unit),
            selectinload(DocumentShare.recipient).selectinload(User.unit)
        ).where(DocumentShare.recipient_id == user_id).order_by(DocumentShare.created_at.desc())
        
        result = await db.execute(query)
        shares = result.scalars().all()
        
        # Batch load channels for all documents to avoid N+1 queries
        document_ids = [share.document_id for share in shares]
        
        # Find all messages containing these documents in channels where user is a member
        channels_by_doc = {}
        if document_ids:
            stmt = (
                select(Message.document_id, Channel)
                .join(Channel, Message.channel_id == Channel.id)
                .join(ChannelMember, ChannelMember.channel_id == Channel.id)
                .where(
                    Message.document_id.in_(document_ids),
                    ChannelMember.user_id == user_id
                )
                .distinct()
            )
            channel_result = await db.execute(stmt)
            
            # Group channels by document_id
            for doc_id, channel in channel_result.all():
                if doc_id not in channels_by_doc:
                    channels_by_doc[doc_id] = []
                channels_by_doc[doc_id].append(channel)
        
        # Populate channels for each share
        for share in shares:
            channels = channels_by_doc.get(share.document_id, [])
            
            # Helper to format name (DM logic if needed, but simple name is fine for now)
            formatted_channels = []
            for c in channels:
                name = c.name
                if c.is_direct:
                     # ideally fetch other user name, but 'DM' or 'Chat' suffices if complex
                     # For now let's try to be smart about DM name if time prompts
                     name = "Личные сообщения" 
                formatted_channels.append({"id": c.id, "name": name})
            
            # Assign to a temporary attribute that Pydantic will pick up
            share.channels = formatted_channels
            
        return shares

    @staticmethod
    async def share_document(db: AsyncSession, document_id: int, recipient_id: int) -> DocumentShare:
        # Check if already shared
        from app.modules.auth.models import User
        query = select(DocumentShare).options(
            selectinload(DocumentShare.document).selectinload(Document.owner).selectinload(User.unit),
            selectinload(DocumentShare.recipient).selectinload(User.unit)
        ).where(
            DocumentShare.document_id == document_id,
            DocumentShare.recipient_id == recipient_id
        )
        result = await db.execute(query)
        existing_share = result.scalars().first()
        if existing_share:
            return existing_share

        share = DocumentShare(document_id=document_id, recipient_id=recipient_id)
        db.add(share)
        await db.commit()
        await db.refresh(share)
        
        # Reload to get relationships
        from app.modules.auth.models import User
        query = select(DocumentShare).options(
            selectinload(DocumentShare.document).selectinload(Document.owner).selectinload(User.unit),
            selectinload(DocumentShare.recipient).selectinload(User.unit)
        ).where(DocumentShare.id == share.id)
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def delete_document(db: AsyncSession, document_id: int) -> bool:
        query = select(Document).where(Document.id == document_id)
        result = await db.execute(query)
        document = result.scalars().first()
        
        if not document:
            return False
            
        await db.delete(document)
        await db.commit()
        return True

    @staticmethod
    async def get_document_share(db: AsyncSession, document_id: int, recipient_id: int) -> Optional[DocumentShare]:
         query = select(DocumentShare).where(
            DocumentShare.document_id == document_id,
            DocumentShare.recipient_id == recipient_id
        )
         result = await db.execute(query)
         return result.scalars().first()
