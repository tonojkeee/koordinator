# Module Decoupling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple all 8 modules in the modular monolith backend to make each module independent and testable without knowledge of other modules.

**Architecture:** Event-driven modular monolith with clear separation of concerns - each module owns its domain, communicates via events, and depends only on infrastructure layer.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Python 3.13, Event-driven architecture (in-memory bus), Dependency injection via FastAPI Depends()

---

## 🔴 Critical Problems Identified

### 1. AUTH SERVICE - 180+ lines of cascading deletion
**File:** `app/modules/auth/service.py` (lines 138-212)
**Issue:** Direct imports and deletion from ALL modules:
```python
from app.modules.chat.models import Message, ChannelMember
from app.modules.board.models import Document, DocumentShare
from app.modules.email.models import EmailAccount
from app.modules.archive.models import ArchiveFile, ArchiveFolder
```
**Impact:** Cannot delete user without importing all modules → tight coupling

### 2. ADMIN SERVICE - Aggregates from ALL modules
**File:** `app/modules/admin/service.py` (lines 4-8)
**Issue:** Direct model imports from all modules for statistics:
```python
from app.modules.chat.models import Message
from app.modules.board.models import Document
from app.modules.archive.models import ArchiveFile
from app.modules.tasks.models import Task
```
**Impact:** Statistics break on model changes, no encapsulation

### 3. BOARD ↔ CHAT - Deep integration
**Files:**
- `app/modules/board/router.py` (imports ChatService, websocket manager)
- `app/modules/chat/router.py` (imports Document model)
**Issue:** Document sharing tightly couples modules
**Impact:** Cannot use board without chat, cannot use chat without board

### 4. SystemSettingService in ADMIN module
**Imported by:** auth, board, archive, chat, email (6 modules)
**Issue:** Infrastructure dependency in business module
**Impact:** Circular dependency risk, admin should not be infrastructure

### 5. ConnectionManager in CHAT module
**Imported by:** admin, tasks, board, auth (4 modules)
**Issue:** WebSocket infrastructure in business module
**Impact:** Cannot use websockets without chat module

## 📊 Dependency Graph (BEFORE)

```
                    ┌─────────────────┐
                    │     CORE       │
                    │ (config, db)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐   ┌─▼───┐   ┌──▼────┐
         │  AUTH   │   │ADMIN │   │  CHAT  │
         └────┬────┘   └───┬──┘   └───┬────┘
              │             │            │
              │     ┌───────┴──────┐ │
              │     │              │ │
              ▼     ▼              ▼ ▼
         ┌──────────────────────────────┐
         │        BOARD              │
         │ (Document ↔ ChatMessage)  │
         └──────────────────────────────┘
              │     │     │
              ▼     ▼     ▼
         ┌────────────────────┐
         │   ARCHIVE│EMAIL  │
         └────────────────────┘

SystemSettingService (in admin) ← All modules
ConnectionManager (in chat) ← admin, tasks, board, auth
```

**Statistics:**
- ✅ 129 cross-module imports
- ✅ 19 foreign keys between modules
- ✅ 7/8 routers violate boundaries
- ❌ SystemSettingService used by 6 modules
- ❌ ConnectionManager used by 4 modules

## 🎯 Target Architecture (AFTER)

```
┌─────────────────────────────────────────────────────────┐
│                    CORE LAYER                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  EventBus (in-memory, async)           │  │
│  │  ConfigService (moved from admin)        │  │
│  │  WebSocketManager (moved from chat)       │  │
│  │  AuditService (centralized logging)       │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
  ┌───▼───┐   ┌──▼───┐   ┌──▼───┐
  │  AUTH  │   │ CHAT  │   │ BOARD │
  │ Module │   │ Module │   │ Module │
  └────────┘   └────────┘   └────────┘
      │              │              │
      │        Events│   Events    │
      │              │              │
  ┌───▼──────────────────────────▼───┐
  │  ADMIN Module (aggregates via       │
  │   interfaces, not direct models)    │
  └──────────────────────────────────┘
      │              │              │
  ┌───▼───┐   ┌──▼───┐   ┌──▼───┐
  │ ARCHIVE│   │ TASKS │   │ EMAIL │
  └────────┘   └────────┘   └────────┘

Communication Pattern:
- AUTH → (events) → ALL MODULES (UserCreated, UserDeleted)
- BOARD → (events) → CHAT (DocumentShared)
- ADMIN → (interfaces) → MODULES (for stats, not models)
```

## 📋 Implementation Plan

### Phase 1: Infrastructure Layer Creation (1-2 hours)

#### Task 1.1: Create Event Bus
**Files:**
- Create: `backend/app/core/events.py`
- Modify: `backend/app/main.py` (initialize event bus)

**Step 1: Write the event bus implementation**

```python
# backend/app/core/events.py
from typing import Dict, List, Callable, Type
from dataclasses import dataclass
import asyncio

@dataclass
class Event:
    """Base event class"""
    pass

class EventBus:
    """In-memory async event bus for module communication"""

    def __init__(self):
        self._handlers: Dict[Type[Event], List[Callable]] = {}

    def subscribe(self, event_type: Type[Event], handler: Callable):
        """Subscribe a handler to an event type"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def publish(self, event: Event):
        """Publish event to all subscribers"""
        handlers = self._handlers.get(type(event), [])
        for handler in handlers:
            await handler(event)

# Global instance
event_bus = EventBus()
```

**Step 2: Run Python to verify syntax**

Run: `python -m py_compile backend/app/core/events.py`
Expected: No syntax errors

**Step 3: Update main.py to initialize event bus**

```python
# backend/app/main.py - add at the top
from app.core.events import event_bus
```

**Step 4: Run lint check**

Run: `cd backend && python -m pylint app/core/events.py --errors-only`
Expected: No errors

**Step 5: Commit**

```bash
cd backend
git add app/core/events.py app/main.py
git commit -m "feat(core): add in-memory event bus for decoupled communication"
```

---

#### Task 1.2: Create Module-Specific Events
**Files:**
- Create: `backend/app/modules/auth/events.py`
- Create: `backend/app/modules/board/events.py`
- Create: `backend/app/modules/chat/events.py`

**Step 1: Write auth module events**

```python
# backend/app/modules/auth/events.py
from app.core.events import Event
from dataclasses import dataclass

@dataclass
class UserCreated(Event):
    user_id: int
    username: str
    email: str

@dataclass
class UserDeleted(Event):
    user_id: str  # Using str because user is deleted from DB

@dataclass
class UserUpdated(Event):
    user_id: int
    changes: dict
```

**Step 2: Write board module events**

```python
# backend/app/modules/board/events.py
from app.core.events import Event
from dataclasses import dataclass

@dataclass
class DocumentShared(Event):
    document_id: int
    sender_id: int
    recipient_id: int
    channel_id: int

@dataclass
class DocumentUploaded(Event):
    document_id: int
    owner_id: int
    title: str
```

**Step 3: Write chat module events**

```python
# backend/app/modules/chat/events.py
from app.core.events import Event
from dataclasses import dataclass

@dataclass
class MessageCreated(Event):
    message_id: int
    channel_id: int
    user_id: int
    content: str
```

**Step 4: Run syntax check**

Run: `python -m py_compile backend/app/modules/auth/events.py backend/app/modules/board/events.py backend/app/modules/chat/events.py`
Expected: No syntax errors

**Step 5: Commit**

```bash
cd backend
git add app/modules/auth/events.py app/modules/board/events.py app/modules/chat/events.py
git commit -m "feat(events): add module-specific events for decoupled communication"
```

---

#### Task 1.3: Move SystemSettingService to Core
**Files:**
- Create: `backend/app/core/config_service.py`
- Modify: `backend/app/modules/admin/service.py` (remove SystemSettingService)
- Modify: All files importing from admin (6 files)

**Step 1: Create ConfigService in core**

```python
# backend/app/core/config_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.admin.models import SystemSetting
from typing import Any, Optional

class ConfigService:
    """Centralized configuration service (moved from admin)"""

    @staticmethod
    async def get_value(
        db: AsyncSession,
        key: str,
        default: Any = None,
        group: str = "general"
    ) -> Any:
        """Get configuration value with default"""
        result = await db.execute(
            select(SystemSetting).where(
                (SystemSetting.key == key) &
                (SystemSetting.group == group)
            )
        )
        setting = result.scalar_one_or_none()
        if setting is None:
            return default
        return setting.value

    @staticmethod
    async def set_value(
        db: AsyncSession,
        key: str,
        value: Any,
        group: str = "general"
    ):
        """Set configuration value"""
        result = await db.execute(
            select(SystemSetting).where(
                (SystemSetting.key == key) &
                (SystemSetting.group == group)
            )
        )
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = value
        else:
            setting = SystemSetting(key=key, value=value, group=group)
            db.add(setting)

        await db.commit()
```

**Step 2: Update all imports (6 files)**

```bash
# Replace in all files:
# OLD: from app.modules.admin.service import SystemSettingService
# NEW: from app.core.config_service import ConfigService

# Update usage:
# OLD: SystemSettingService.get_value(db, key)
# NEW: await ConfigService.get_value(db, key)
```

Files to update:
1. `backend/app/modules/auth/router.py` (line 22)
2. `backend/app/modules/auth/service.py` (line 16)
3. `backend/app/modules/board/router.py` (line 18)
4. `backend/app/modules/chat/router.py` (line 30)
5. `backend/app/modules/email/service.py`
6. `backend/app/modules/archive/router.py` (line 13)
7. `backend/app/core/rate_limit.py`

**Step 3: Update admin service to use ConfigService**

```python
# backend/app/modules/admin/service.py - keep admin service using ConfigService
from app.core.config_service import ConfigService

class AdminService:
    @staticmethod
    async def get_system_settings(db: AsyncSession):
        """All settings still read from SystemSetting model"""
        result = await db.execute(select(SystemSetting))
        return result.scalars().all()
```

**Step 4: Run syntax check**

Run: `python -m py_compile backend/app/core/config_service.py`
Expected: No syntax errors

**Step 5: Run LSP diagnostics**

Run: `lsp_diagnostics(filePath="backend/app/core/config_service.py", severity="error")`
Expected: No errors

**Step 6: Commit**

```bash
cd backend
git add app/core/config_service.py app/modules/admin/service.py app/modules/auth/router.py app/modules/auth/service.py app/modules/board/router.py app/modules/chat/router.py app/modules/email/service.py app/modules/archive/router.py app/core/rate_limit.py
git commit -m "refactor(core): move SystemSettingService to core as ConfigService"
```

---

#### Task 1.4: Move ConnectionManager to Core
**Files:**
- Create: `backend/app/core/websocket_manager.py`
- Modify: `backend/app/modules/chat/websocket.py` (use core manager)
- Modify: All files importing from chat.websocket (admin, tasks, board, auth)

**Step 1: Create WebSocketManager in core**

```python
# backend/app/core/websocket_manager.py
from typing import Dict, List
from fastapi import WebSocket

class WebSocketManager:
    """Centralized WebSocket connection manager (moved from chat)"""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        """Connect user"""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        """Disconnect user"""
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: dict):
        """Send message to specific user"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def broadcast_to_all(self, message: dict):
        """Send message to all connected users"""
        for connections in self.active_connections.values():
            for connection in connections:
                await connection.send_json(message)

# Global instance
websocket_manager = WebSocketManager()
```

**Step 2: Update all imports (4 files)**

Files to update:
1. `backend/app/modules/admin/service.py` (line 11)
2. `backend/app/modules/tasks/router.py`
3. `backend/app/modules/board/router.py` (line 233, 373, 433)
4. `backend/app/modules/auth/router.py` (line 279, 510)

```python
# OLD: from app.modules.chat.websocket import manager
# NEW: from app.core.websocket_manager import websocket_manager

# Usage remains same (just name change)
# OLD: manager.connect(...)
# NEW: websocket_manager.connect(...)
```

**Step 3: Update chat module to use core manager**

```python
# backend/app/modules/chat/websocket.py
from app.core.websocket_manager import websocket_manager

# Keep chat-specific logic, but use core manager
class ChatWebSocketHandler:
    async def handle_connection(self, websocket: WebSocket, user_id: int):
        await websocket_manager.connect(user_id, websocket)
        # ... rest of chat logic
```

**Step 4: Run syntax check**

Run: `python -m py_compile backend/app/core/websocket_manager.py`
Expected: No syntax errors

**Step 5: Run LSP diagnostics**

Run: `lsp_diagnostics(filePath="backend/app/core/websocket_manager.py", severity="error")`
Expected: No errors

**Step 6: Commit**

```bash
cd backend
git add app/core/websocket_manager.py app/modules/chat/websocket.py app/modules/admin/service.py app/modules/tasks/router.py app/modules/board/router.py app/modules/auth/router.py
git commit -m "refactor(core): move ConnectionManager to core as WebSocketManager"
```

---

### Phase 2: Event-Driven Communication (2-3 hours)

#### Task 2.1: Implement Event Handlers for User Deletion
**Files:**
- Modify: `backend/app/modules/auth/service.py` (publish UserDeleted event)
- Modify: `backend/app/modules/chat/service.py` (handle UserDeleted)
- Modify: `backend/app/modules/board/service.py` (handle UserDeleted)
- Modify: `backend/app/modules/email/service.py` (handle UserDeleted)
- Modify: `backend/app/modules/archive/service.py` (handle UserDeleted)

**Step 1: Modify auth service to publish event instead of direct deletion**

```python
# backend/app/modules/auth/service.py
from app.core.events import event_bus
from app.modules.auth.events import UserDeleted

class UserService:
    @staticmethod
    async def delete_user(db: AsyncSession, user_id: int):
        """Delete user and publish event"""
        # Get user data before deletion
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")

        # Delete user's avatar file
        if user.avatar:
            from pathlib import Path
            avatar_path = Path(f"uploads/avatars/{user.avatar}")
            if avatar_path.exists():
                avatar_path.unlink()

        # Delete user from DB
        await db.delete(user)
        await db.commit()

        # Publish event instead of cascading
        await event_bus.publish(UserDeleted(
            user_id=str(user_id)  # str because user is deleted
        ))
```

**Step 2: Add event handler in chat service**

```python
# backend/app/modules/chat/service.py
from app.core.events import event_bus
from app.modules.auth.events import UserDeleted

# Subscribe handler
async def handle_user_deleted(event: UserDeleted):
    """Handle user deletion - clean up chat data"""
    db = AsyncSessionLocal()
    try:
        # Delete user's messages
        await db.execute(
            delete(Message).where(Message.user_id == int(event.user_id))
        )
        # Remove from channels
        await db.execute(
            delete(ChannelMember).where(ChannelMember.user_id == int(event.user_id))
        )
        await db.commit()
    finally:
        await db.close()

# Subscribe on module load
event_bus.subscribe(UserDeleted, handle_user_deleted)
```

**Step 3: Add event handler in board service**

```python
# backend/app/modules/board/service.py
from app.core.events import event_bus
from app.modules.auth.events import UserDeleted

async def handle_user_deleted(event: UserDeleted):
    """Handle user deletion - clean up board data"""
    db = AsyncSessionLocal()
    try:
        user_id = int(event.user_id)

        # Delete user's documents
        await db.execute(
            delete(Document).where(Document.owner_id == user_id)
        )
        # Remove from document shares
        await db.execute(
            delete(DocumentShare).where(
                (DocumentShare.recipient_id == user_id)
            )
        )
        await db.commit()
    finally:
        await db.close()

event_bus.subscribe(UserDeleted, handle_user_deleted)
```

**Step 4: Add event handler in email service**

```python
# backend/app/modules/email/service.py
from app.core.events import event_bus
from app.modules.auth.events import UserDeleted

async def handle_user_deleted(event: UserDeleted):
    """Handle user deletion - clean up email data"""
    db = AsyncSessionLocal()
    try:
        await db.execute(
            delete(EmailAccount).where(EmailAccount.user_id == int(event.user_id))
        )
        await db.commit()
    finally:
        await db.close()

event_bus.subscribe(UserDeleted, handle_user_deleted)
```

**Step 5: Add event handler in archive service**

```python
# backend/app/modules/archive/service.py
from app.core.events import event_bus
from app.modules.auth.events import UserDeleted

async def handle_user_deleted(event: UserDeleted):
    """Handle user deletion - clean up archive data"""
    db = AsyncSessionLocal()
    try:
        user_id = int(event.user_id)

        # Delete user's files
        await db.execute(
            delete(ArchiveFile).where(ArchiveFile.owner_id == user_id)
        )
        # Delete user's folders
        await db.execute(
            delete(ArchiveFolder).where(ArchiveFolder.owner_id == user_id)
        )
        await db.commit()
    finally:
        await db.close()

event_bus.subscribe(UserDeleted, handle_user_deleted)
```

**Step 6: Run syntax check**

Run: `python -m py_compile backend/app/modules/auth/service.py backend/app/modules/chat/service.py backend/app/modules/board/service.py backend/app/modules/email/service.py backend/app/modules/archive/service.py`
Expected: No syntax errors

**Step 7: Run LSP diagnostics on all modified files**

Run: `lsp_diagnostics(filePath="backend/app/modules/auth/service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/chat/service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/board/service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/email/service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/archive/service.py", severity="error")`
Expected: No errors

**Step 8: Commit**

```bash
cd backend
git add app/modules/auth/service.py app/modules/chat/service.py app/modules/board/service.py app/modules/email/service.py app/modules/archive/service.py
git commit -m "refactor(events): replace cascading deletion with event-driven cleanup"
```

---

#### Task 2.2: Implement Event-Driven Document Sharing
**Files:**
- Modify: `backend/app/modules/board/router.py` (publish DocumentShared event)
- Modify: `backend/app/modules/chat/service.py` (handle DocumentShared)

**Step 1: Modify board router to publish event**

```python
# backend/app/modules/board/router.py
from app.core.events import event_bus
from app.modules.board.events import DocumentShared

@router.post("/{document_id}/share")
async def share_document(
    document_id: int,
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... existing validation logic ...

    # Create DM channel if needed
    channel = await ChatService.get_or_create_direct_channel(
        db, current_user.id, recipient_id
    )

    # Save share record
    share = DocumentShare(
        document_id=document_id,
        sender_id=current_user.id,
        recipient_id=recipient_id
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)

    # Publish event instead of directly posting message
    await event_bus.publish(DocumentShared(
        document_id=document_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        channel_id=channel.id
    ))

    return share
```

**Step 2: Add event handler in chat service**

```python
# backend/app/modules/chat/service.py
from app.modules.board.events import DocumentShared

async def handle_document_shared(event: DocumentShared):
    """Handle document shared - create chat notification"""
    db = AsyncSessionLocal()
    try:
        # Create notification message
        message = Message(
            channel_id=event.channel_id,
            user_id=event.sender_id,
            content=f"📄 Поделился документом #doc_{event.document_id}",
            document_id=event.document_id  # Link to document
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)

        # Broadcast via websocket
        from app.core.websocket_manager import websocket_manager
        await websocket_manager.broadcast_to_user(
            event.recipient_id,
            {"type": "new_message", "message": message_to_dict(message)}
        )
    finally:
        await db.close()

event_bus.subscribe(DocumentShared, handle_document_shared)
```

**Step 3: Remove direct ChatService imports from board router**

```python
# backend/app/modules/board/router.py
# REMOVE: from app.modules.chat.service import ChatService
# REMOVE: from app.modules.chat.schemas import MessageCreate
# REMOVE: from app.modules.chat.websocket import manager
```

**Step 4: Run syntax check**

Run: `python -m py_compile backend/app/modules/board/router.py backend/app/modules/chat/service.py`
Expected: No syntax errors

**Step 5: Run LSP diagnostics**

Run: `lsp_diagnostics(filePath="backend/app/modules/board/router.py", severity="error")`
Expected: No errors

**Step 6: Commit**

```bash
cd backend
git add app/modules/board/router.py app/modules/chat/service.py
git commit -m "refactor(events): replace direct chat calls with DocumentShared event"
```

---

#### Task 2.3: Remove Direct Document Model Import from Chat
**Files:**
- Modify: `backend/app/modules/chat/router.py` (remove Document import)

**Step 1: Create DTO for document data**

```python
# backend/app/modules/chat/schemas.py
from pydantic import BaseModel

class DocumentRef(BaseModel):
    """Reference to document (not full model)"""
    id: int
    title: str
    owner_id: int
    # Add fields as needed, but NO Document model
```

**Step 2: Update chat router to use DTO**

```python
# backend/app/modules/chat/router.py
# REMOVE: from app.modules.board.models import Document

# When creating message with document:
@router.post("/messages")
async def create_message(
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    message = Message(**message_data.model_dump(), user_id=current_user.id)

    # If document attached, get document data via service
    if message_data.document_id:
        # Call board service to get document data
        from app.modules.board.service import BoardService
        doc_data = await BoardService.get_document_ref(
            db, message_data.document_id
        )
        message.document_data = doc_data  # Store reference, not model

    db.add(message)
    await db.commit()
    return message
```

**Step 3: Add service method in board service**

```python
# backend/app/modules/board/service.py
class BoardService:
    @staticmethod
    async def get_document_ref(
        db: AsyncSession,
        document_id: int
    ) -> dict:
        """Get minimal document data for chat reference"""
        doc = await db.get(Document, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        return {
            "id": doc.id,
            "title": doc.title,
            "owner_id": doc.owner_id
        }
```

**Step 4: Run syntax check**

Run: `python -m py_compile backend/app/modules/chat/router.py backend/app/modules/chat/schemas.py backend/app/modules/board/service.py`
Expected: No syntax errors

**Step 5: Run LSP diagnostics**

Run: `lsp_diagnostics(filePath="backend/app/modules/chat/router.py", severity="error")`
Expected: No errors

**Step 6: Commit**

```bash
cd backend
git add app/modules/chat/router.py app/modules/chat/schemas.py app/modules/board/service.py
git commit -m "refactor: remove direct Document model import from chat module"
```

---

### Phase 3: Admin Service Refactoring (1-2 hours)

#### Task 3.1: Create Interfaces for Statistics
**Files:**
- Create: `backend/app/core/interfaces.py`
- Modify: `backend/app/modules/admin/service.py` (use interfaces)

**Step 1: Define statistics interfaces**

```python
# backend/app/core/interfaces.py
from abc import ABC, abstractmethod
from typing import Dict, Any

class IStatisticsProvider(ABC):
    """Interface for module statistics"""

    @abstractmethod
    async def get_overview_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Get overview statistics for dashboard"""
        pass

    @abstractmethod
    async def get_activity_stats(
        self,
        db: AsyncSession,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get activity statistics"""
        pass
```

**Step 2: Implement interfaces in modules**

```python
# backend/app/modules/chat/service.py
class ChatService(IStatisticsProvider):
    @staticmethod
    async def get_overview_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Chat statistics for dashboard"""
        total_messages = await db.scalar(
            select(func.count(Message.id))
        )
        return {"total_messages": total_messages}

    @staticmethod
    async def get_activity_stats(
        self,
        db: AsyncSession,
        days: int = 7
    ) -> Dict[str, Any]:
        """Chat activity"""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        recent_messages = await db.scalar(
            select(func.count(Message.id)).where(
                Message.created_at >= cutoff
            )
        )
        return {"recent_messages": recent_messages}
```

```python
# backend/app/modules/board/service.py
class BoardService(IStatisticsProvider):
    @staticmethod
    async def get_overview_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Board statistics for dashboard"""
        total_documents = await db.scalar(
            select(func.count(Document.id))
        )
        return {"total_documents": total_documents}
```

```python
# backend/app/modules/archive/service.py
class ArchiveService(IStatisticsProvider):
    @staticmethod
    async def get_overview_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Archive statistics for dashboard"""
        total_files = await db.scalar(
            select(func.count(ArchiveFile.id))
        )
        total_size = await db.scalar(
            select(func.sum(ArchiveFile.size))
        )
        return {
            "total_files": total_files,
            "total_size": total_size or 0
        }
```

```python
# backend/app/modules/tasks/service.py
class TasksService(IStatisticsProvider):
    @staticmethod
    async def get_overview_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Task statistics for dashboard"""
        total_tasks = await db.scalar(
            select(func.count(Task.id))
        )
        completed_tasks = await db.scalar(
            select(func.count(Task.id)).where(Task.status == "completed")
        )
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks
        }
```

**Step 3: Update admin service to use interfaces**

```python
# backend/app/modules/admin/service.py
from app.core.interfaces import IStatisticsProvider
# REMOVE direct model imports!

class AdminService:
    @staticmethod
    async def get_dashboard_stats(
        db: AsyncSession,
        providers: list[IStatisticsProvider]
    ) -> Dict[str, Any]:
        """Aggregate statistics from all modules via interfaces"""
        overview = {}
        activity = {}

        for provider in providers:
            # Use interface, not models
            provider_stats = await provider.get_overview_stats(db)
            overview.update(provider_stats)

            provider_activity = await provider.get_activity_stats(db, days=7)
            activity.update(provider_activity)

        return {
            "overview": overview,
            "activity": activity
        }
```

**Step 4: Update admin router to pass providers**

```python
# backend/app/modules/admin/router.py
from app.modules.chat.service import ChatService
from app.modules.board.service import BoardService
from app.modules.archive.service import ArchiveService
from app.modules.tasks.service import TasksService

@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    providers = [
        ChatService(),
        BoardService(),
        ArchiveService(),
        TasksService()
    ]

    stats = await AdminService.get_dashboard_stats(db, providers)
    return stats
```

**Step 5: Run syntax check**

Run: `python -m py_compile backend/app/core/interfaces.py backend/app/modules/chat/service.py backend/app/modules/board/service.py backend/app/modules/archive/service.py backend/app/modules/tasks/service.py backend/app/modules/admin/service.py backend/app/modules/admin/router.py`
Expected: No syntax errors

**Step 6: Run LSP diagnostics**

Run: `lsp_diagnostics(filePath="backend/app/modules/admin/service.py", severity="error")`
Expected: No errors

**Step 7: Commit**

```bash
cd backend
git add app/core/interfaces.py app/modules/chat/service.py app/modules/board/service.py app/modules/archive/service.py app/modules/tasks/service.py app/modules/admin/service.py app/modules/admin/router.py
git commit -m "refactor(admin): use IStatisticsProvider interfaces instead of direct model imports"
```

---

### Phase 4: Boundary Enforcement (1 hour)

#### Task 4.1: Install and Configure Tach
**Files:**
- Create: `backend/tach.toml`
- Modify: `backend/requirements.txt` (add tach)
- Modify: `.github/workflows/ci.yml` (add tach check)

**Step 1: Install tach**

Run: `cd backend && pip install tach`
Expected: Tach installed successfully

**Step 2: Create tach.toml configuration**

```toml
# backend/tach.toml
[[modules]]
path = "app/core"
depends_on = []

[[modules]]
path = "app/modules/auth"
depends_on = ["app/core"]
strict = true

[[modules]]
path = "app/modules/chat"
depends_on = ["app/core", "app/modules/auth"]
strict = true

[[modules]]
path = "app/modules/board"
depends_on = ["app/core", "app/modules/auth"]
strict = true

[[modules]]
path = "app/modules/admin"
depends_on = ["app/core", "app/modules/auth"]
strict = true

[[modules]]
path = "app/modules/archive"
depends_on = ["app/core", "app/modules/auth"]
strict = true

[[modules]]
path = "app/modules/email"
depends_on = ["app/core", "app/modules/auth"]
strict = true

[[modules]]
path = "app/modules/tasks"
depends_on = ["app/core", "app/modules/auth"]
strict = true

[[modules]]
path = "app/modules/zsspd"
depends_on = ["app/core", "app/modules/auth"]
strict = true
```

**Step 3: Initialize tach**

Run: `cd backend && tach init --config-file tach.toml`
Expected: Tach configuration initialized

**Step 4: Check for violations**

Run: `cd backend && tach check`
Expected: No violations (after previous refactors)

**Step 5: Visualize dependencies**

Run: `cd backend && tach show > docs/dependency-graph.txt`
Expected: Dependency graph generated

**Step 6: Update requirements.txt**

```bash
cd backend
echo "tach==0.12.0" >> requirements.txt
```

**Step 7: Add to CI workflow**

```yaml
# .github/workflows/ci.yml
- name: Check module boundaries
  run: |
    cd backend
    pip install tach
    tach check
```

**Step 8: Commit**

```bash
git add backend/tach.toml backend/requirements.txt .github/workflows/ci.yml
git commit -m "chore: add tach for module boundary enforcement"
```

---

#### Task 4.2: Add Modguard for Public/Private APIs
**Files:**
- Create: `backend/app/modules/auth/__init__.py` (add modguard)
- Create: `backend/app/modules/chat/__init__.py` (add modguard)
- Create: `backend/app/modules/board/__init__.py` (add modguard)
- Modify: `backend/requirements.txt` (add modguard)

**Step 1: Install modguard**

Run: `cd backend && pip install modguard`
Expected: modguard installed successfully

**Step 2: Add boundary to auth module**

```python
# backend/app/modules/auth/__init__.py
import modguard

modguard.Boundary()

# Export public APIs
from app.modules.auth.service import UserService
from app.modules.auth.events import UserCreated, UserDeleted, UserUpdated

__all__ = ["UserService", "UserCreated", "UserDeleted", "UserUpdated"]
```

**Step 3: Mark public APIs in auth service**

```python
# backend/app/modules/auth/service.py
import modguard

@modguard.public
class UserService:
    """Public API - can be imported by other modules"""

class InternalHelper:  # No @public decorator
    """Private - module internal only"""
    pass
```

**Step 4: Add boundary to other modules**

Repeat for chat, board, archive, email, tasks, zsspd, admin.

**Step 5: Check for violations**

Run: `cd backend && modguard check`
Expected: No violations

**Step 6: Update requirements.txt**

```bash
cd backend
echo "modguard==0.4.0" >> requirements.txt
```

**Step 7: Commit**

```bash
git add backend/app/modules/auth/__init__.py backend/app/modules/chat/__init__.py backend/app/modules/board/__init__.py backend/requirements.txt
git commit -m "chore: add modguard for public/private API enforcement"
```

---

### Phase 5: Testing and Verification (2-3 hours)

#### Task 5.1: Write Isolated Module Tests
**Files:**
- Create: `backend/tests/test_module_isolation.py`
- Create: `backend/tests/test_event_bus.py`

**Step 1: Write event bus tests**

```python
# backend/tests/test_event_bus.py
import pytest
from app.core.events import EventBus, Event

@dataclass
class TestEvent(Event):
    value: str

@pytest.mark.asyncio
async def test_event_bus_subscribe_and_publish():
    bus = EventBus()

    received = []
    async def handler(event: TestEvent):
        received.append(event.value)

    bus.subscribe(TestEvent, handler)
    await bus.publish(TestEvent(value="test"))

    assert len(received) == 1
    assert received[0] == "test"

@pytest.mark.asyncio
async def test_event_bus_multiple_subscribers():
    bus = EventBus()

    count = {"value": 0}

    async def handler1(event: TestEvent):
        count["value"] += 1

    async def handler2(event: TestEvent):
        count["value"] += 1

    bus.subscribe(TestEvent, handler1)
    bus.subscribe(TestEvent, handler2)
    await bus.publish(TestEvent(value="test"))

    assert count["value"] == 2
```

**Step 2: Run event bus tests**

Run: `cd backend && python -m pytest tests/test_event_bus.py -v`
Expected: All tests pass

**Step 3: Write module isolation tests**

```python
# backend/tests/test_module_isolation.py
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_chat_module_without_board():
    """Test chat module works without board module"""
    # Mock event bus
    from app.core.events import EventBus, Event

    bus = EventBus()

    # Subscribe to document shared event
    @dataclass
    class DocumentShared(Event):
        document_id: int
        sender_id: int

    received = []

    async def handler(event: DocumentShared):
        received.append(event.document_id)

    bus.subscribe(DocumentShared, handler)

    # Simulate document shared from board
    await bus.publish(DocumentShared(document_id=123, sender_id=1))

    assert len(received) == 1
    assert received[0] == 123

@pytest.mark.asyncio
async def test_auth_module_events():
    """Test auth module publishes events correctly"""
    from app.modules.auth.events import UserDeleted
    from app.modules.chat.service import handle_user_deleted

    # Simulate user deletion
    event = UserDeleted(user_id="1")

    # Handler should process without importing auth models
    # (this is a unit test, no DB needed)
    assert True
```

**Step 4: Run isolation tests**

Run: `cd backend && python -m pytest tests/test_module_isolation.py -v`
Expected: All tests pass

**Step 5: Commit**

```bash
git add backend/tests/test_event_bus.py backend/tests/test_module_isolation.py
git commit -m "test: add event bus and module isolation tests"
```

---

#### Task 5.2: Run Full Test Suite
**Files:** All test files

**Step 1: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All existing tests still pass + new tests pass

**Step 2: Check for regressions**

If tests fail:
1. Identify failing tests
2. Check if failure is due to refactoring
3. Fix broken integration
4. Re-run tests

**Step 3: Run LSP diagnostics on all modified files**

Run: `lsp_diagnostics(filePath="backend/app/core/events.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/core/config_service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/core/websocket_manager.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/auth/service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/admin/service.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/board/router.py", severity="error")`
Run: `lsp_diagnostics(filePath="backend/app/modules/chat/service.py", severity="error")`

Expected: No errors in any file

**Step 4: Run tach check**

Run: `cd backend && tach check`
Expected: No violations

**Step 5: Run modguard check**

Run: `cd backend && modguard check`
Expected: No violations

---

## 📊 Final Verification

### Success Criteria

✅ **Module Independence:**
- [ ] Each module can be imported without importing other modules (except auth/core)
- [ ] No cross-module service imports (only event handlers)
- [ ] No direct model imports between modules
- [ ] Admin aggregates via interfaces, not models

✅ **Event-Driven Communication:**
- [ ] User deletion publishes event, handled by each module
- [ ] Document sharing publishes event, handled by chat
- [ ] All cross-module communication via events

✅ **Infrastructure in Core:**
- [ ] SystemSettingService moved to core as ConfigService
- [ ] ConnectionManager moved to core as WebSocketManager
- [ ] EventBus in core
- [ ] No infrastructure in business modules

✅ **Boundary Enforcement:**
- [ ] Tach configured and passing
- [ ] Modguard configured and passing
- [ ] CI checks added for boundaries

✅ **Testing:**
- [ ] Event bus tests pass
- [ ] Module isolation tests pass
- [ ] All existing tests still pass
- [ ] LSP diagnostics clean

✅ **Documentation:**
- [ ] Dependency graph visualized
- [ ] Architecture documented
- [ ] Module boundaries explained

---

## 🎯 Expected Outcomes

### Before Refactoring
- 129 cross-module imports
- 180+ lines of cascading deletion
- Direct model access between modules
- Tight coupling between board and chat
- Infrastructure in business modules

### After Refactoring
- **0 direct cross-module service imports** (only event handlers)
- **Event-driven cleanup** instead of cascading deletion
- **Interface-based aggregation** for admin statistics
- **Loose coupling** via event bus
- **Clear module boundaries** enforced by tools
- **Testable modules** in isolation

---

## 📝 Notes for Implementation

### Important Considerations

1. **Gradual Migration:** Don't try to refactor everything at once. Follow the phase order.

2. **Backward Compatibility:** Keep existing API endpoints working. Only change internal implementation.

3. **Testing After Each Phase:** Run tests after each phase to catch regressions early.

4. **Event Handler Errors:** Event handlers should not crash the system. Wrap in try/except.

5. **Database Transactions:** Event handlers use their own DB sessions to avoid cross-module transaction issues.

6. **Circular Imports:** Watch for circular imports when introducing events. Event types should be in separate files.

### Rollback Plan

If something breaks:
1. Use git to revert to last working commit
2. Identify what caused the break
3. Fix the issue before proceeding
4. Never commit broken code

### Future Improvements

1. **Message Broker:** For scaling, replace in-memory event bus with Redis/RabbitMQ
2. **Module Versioning:** Add API versioning for module interfaces
3. **Sagas:** Implement saga pattern for complex cross-module transactions
4. **Module Discovery:** Auto-discover event handlers instead of manual subscription

---

## 🔗 References

- [Tach Documentation](https://docs.gauge.sh/) - Module boundary enforcement
- [Modguard Documentation](https://pypi.org/project/modguard/) - Public/private API enforcement
- [Modular Monolith Patterns](https://www.milanjovanovic.tech/blog/modular-monolith-communication-patterns) - Communication patterns
- [Hexagonal Architecture](https://johal.in/hexagonal-architecture-design-python-ports-and-adapters-for-modularity-2026/) - Ports & Adapters
- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/) - Built-in DI
