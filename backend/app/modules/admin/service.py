from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload, defer
from app.modules.auth.models import User, Unit
from app.modules.chat.models import Message
from app.modules.board.models import Document
from app.modules.archive.models import ArchiveFile
from app.modules.tasks.models import Task, TaskStatus
from app.modules.admin.models import AuditLog
from app.core.models import SystemSetting
from datetime import datetime, timedelta
from app.core.websocket_manager import websocket_manager as manager
from app.core.config import get_settings
from app.core.config_service import ConfigService

settings = get_settings()


# Settings cache with TTL
_settings_cache: dict = {}
_cache_ttl_seconds = 60  # Cache for 60 seconds


class SystemSettingService:
    @staticmethod
    async def get_value(db: AsyncSession, key: str, default: any = None) -> any:
        """
        Get type-casted value from system_settings with caching.
        Uses in-memory cache with TTL to reduce DB queries.
        """
        # Check cache first
        if key in _settings_cache:
            value, cached_type, expires = _settings_cache[key]
            if datetime.utcnow() < expires:
                # Return cached value with proper type conversion
                if cached_type == 'int':
                    return int(value)
                elif cached_type == 'bool':
                    return value.lower() == 'true'
                elif cached_type == 'json':
                    import json
                    return json.loads(value)
                return value
        
        # Fetch from DB
        setting = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        if not setting:
            return default
        
        # Store in cache with expiry
        _settings_cache[key] = (
            setting.value,
            setting.type,
            datetime.utcnow() + timedelta(seconds=_cache_ttl_seconds)
        )
            
        val = setting.value
        if setting.type == 'int':
            return int(val)
        elif setting.type == 'bool':
            return val.lower() == 'true'
        elif setting.type == 'json':
            import json
            return json.loads(val)
        return val
    
    @staticmethod
    def invalidate_cache(key: str = None):
        """
        Invalidate settings cache.
        If key is None, invalidate all cached settings.
        """
        global _settings_cache
        if key:
            _settings_cache.pop(key, None)
        else:
            _settings_cache = {}

    @staticmethod
    async def set_value(db: AsyncSession, key: str, value: any, user_id: int) -> SystemSetting:
        """Update or create a setting"""
        setting = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        
        # Convert type to string
        str_val = str(value)
        setting_type = 'str'
        if isinstance(value, bool):
            setting_type = 'bool'
            str_val = 'true' if value else 'false'
        elif isinstance(value, int):
            setting_type = 'int'
        
        if not setting:
            setting = SystemSetting(key=key, value=str_val, type=setting_type)
            db.add(setting)
        else:
            old_val = setting.value
            setting.value = str_val
            
            # Audit log
            if old_val != str_val:
                await AdminService.create_audit_log(
                    db, user_id, "update_setting", "system_setting", key, 
                    f"Changed {key} from '{old_val}' to '{str_val}'"
                )
        
        await db.commit()
        await db.refresh(setting)
        return setting

    @staticmethod
    async def get_all_settings(db: AsyncSession):
        """Get all settings"""
        result = await db.execute(
            select(SystemSetting)
            .where(SystemSetting.key != "app_version")
            .order_by(SystemSetting.group, SystemSetting.key)
        )
        return result.scalars().all()

    @staticmethod
    async def get_public_settings(db: AsyncSession) -> dict:
        """Get only public settings"""
        result = await db.execute(select(SystemSetting).where(SystemSetting.is_public == True))
        settings_list = result.scalars().all()
        
        config = {
            "app_name": await ConfigService.get_value(db, "app_name", "КООРДИНАТОР"),
            "app_version": await ConfigService.get_value(db, "app_version", "1.0.0"),
            "allow_registration": True
        }
        
        for s in settings_list:
            if s.key == "app_version":
                continue
            val = s.value
            if s.type == 'bool':
                val = val.lower() == 'true'
            elif s.type == 'int':
                val = int(val)
            config[s.key] = val
            
        return config

class AdminService:
    @staticmethod
    async def get_system_settings(db: AsyncSession):
        """All settings still read from SystemSetting model"""
        result = await db.execute(select(SystemSetting))
        return result.scalars().all()

    @staticmethod
    async def get_overview_stats(db: AsyncSession):
        """Get high-level counts for the dashboard"""
        
        # Count Users
        user_count = await db.scalar(select(func.count(User.id)))
        
        # Count Online Users from real-time WebSocket manager
        online_count = len(manager.user_connections)
        
        # Count Messages Today
        today = datetime.utcnow().date()
        msg_count = await db.scalar(select(func.count(Message.id)).where(Message.created_at >= today))
        
        # Count Total Files (Archive + Documents)
        archive_count = await db.scalar(select(func.count(ArchiveFile.id)))
        doc_count = await db.scalar(select(func.count(Document.id)))
        
        # Sum Total Size
        archive_size = await db.scalar(select(func.sum(ArchiveFile.file_size))) or 0
        doc_size = await db.scalar(select(func.sum(Document.file_size))) or 0
        
        # Count Tasks
        tasks_total = await db.scalar(select(func.count(Task.id)))
        tasks_completed = await db.scalar(select(func.count(Task.id)).where(Task.status == TaskStatus.COMPLETED))
        tasks_in_progress = await db.scalar(select(func.count(Task.id)).where(Task.status == TaskStatus.IN_PROGRESS))
        tasks_on_review = await db.scalar(select(func.count(Task.id)).where(Task.status == TaskStatus.ON_REVIEW))
        tasks_overdue = await db.scalar(select(func.count(Task.id)).where(Task.status == TaskStatus.OVERDUE))
        
        return {
            "total_users": user_count,
            "online_users": online_count,
            "messages_today": msg_count,
            "total_files": archive_count + doc_count,
            "total_storage_size": archive_size + doc_size,
            "tasks_total": tasks_total,
            "tasks_completed": tasks_completed,
            "tasks_in_progress": tasks_in_progress,
            "tasks_on_review": tasks_on_review,
            "tasks_overdue": tasks_overdue
        }

    @staticmethod
    async def get_activity_stats(db: AsyncSession, days: int = 7):
        """
        Get daily activity for charts using SQL aggregation.
        Uses GROUP BY for efficient aggregation instead of loading all records.
        """
        from app.core.config import get_settings
        
        settings = get_settings()
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Initialize stats dict with all dates
        stats = {}
        for i in range(days):
            date = (datetime.utcnow() - timedelta(days=days-1-i)).date().isoformat()
            stats[date] = {"date": date, "messages": 0, "new_users": 0, "new_tasks": 0}
        
        # SQL aggregation differs between SQLite and MySQL
        if settings.is_sqlite:
            # SQLite date() function
            date_func = func.date(Message.created_at)
            user_date_func = func.date(User.created_at)
            task_date_func = func.date(Task.created_at)
        else:
            # MySQL DATE() function
            date_func = func.date(Message.created_at)
            user_date_func = func.date(User.created_at)
            task_date_func = func.date(Task.created_at)
        
        # Messages - SQL GROUP BY
        msg_stmt = (
            select(date_func.label('date'), func.count(Message.id).label('count'))
            .where(Message.created_at >= start_date)
            .group_by(date_func)
        )
        msg_result = await db.execute(msg_stmt)
        for row in msg_result.all():
            date_str = str(row.date)
            if date_str in stats:
                stats[date_str]["messages"] = row.count
        
        # Users - SQL GROUP BY
        user_stmt = (
            select(user_date_func.label('date'), func.count(User.id).label('count'))
            .where(User.created_at >= start_date)
            .group_by(user_date_func)
        )
        user_result = await db.execute(user_stmt)
        for row in user_result.all():
            date_str = str(row.date)
            if date_str in stats:
                stats[date_str]["new_users"] = row.count
        
        # Tasks - SQL GROUP BY
        task_stmt = (
            select(task_date_func.label('date'), func.count(Task.id).label('count'))
            .where(Task.created_at >= start_date)
            .group_by(task_date_func)
        )
        task_result = await db.execute(task_stmt)
        for row in task_result.all():
            date_str = str(row.date)
            if date_str in stats:
                stats[date_str]["new_tasks"] = row.count
                
        return list(stats.values())

    @staticmethod
    async def get_storage_stats(db: AsyncSession):
        """Get actual storage usage by file type"""
        
        # Fetch all files to categorize in Python (safer for cross-DB compatibility)
        archive_files = (await db.execute(select(ArchiveFile.file_size, ArchiveFile.mime_type, ArchiveFile.file_path))).all()
        board_docs = (await db.execute(select(Document.file_size, Document.file_path))).all()
        
        categories = {
            "Images": {"value": 0, "count": 0, "color": "#8884d8"},
            "Videos": {"value": 0, "count": 0, "color": "#82ca9d"},
            "Documents": {"value": 0, "count": 0, "color": "#ffc658"},
            "Audio": {"value": 0, "count": 0, "color": "#ff8042"},
            "Archives": {"value": 0, "count": 0, "color": "#0088fe"},
            "Other": {"value": 0, "count": 0, "color": "#00c49f"},
        }

        def categorize(mime: str, path: str):
            if mime:
                if mime.startswith('image/'): return "Images"
                if mime.startswith('video/'): return "Videos"
                if mime.startswith('audio/'): return "Audio"
                if mime in ('application/pdf', 'application/msword', 'text/plain') or \
                   mime.startswith('application/vnd.openxmlformats-officedocument'): return "Documents"
                if mime in ('application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar'): return "Archives"
            
            # Fallback to extension
            ext = path.lower().split('.')[-1] if '.' in path else ''
            if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'): return "Images"
            if ext in ('mp4', 'mkv', 'avi', 'mov', 'webm'): return "Videos"
            if ext in ('mp3', 'wav', 'ogg', 'flac'): return "Audio"
            if ext in ('pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'): return "Documents"
            if ext in ('zip', 'rar', '7z', 'tar', 'gz'): return "Archives"
            
            return "Other"

        # Process ArchiveFiles
        for size, mime, path in archive_files:
            cat = categorize(mime, path)
            categories[cat]["value"] += size or 0
            categories[cat]["count"] += 1

        # Process Board Documents
        for size, path in board_docs:
            cat = categorize(None, path)
            categories[cat]["value"] += size or 0
            categories[cat]["count"] += 1

        # Format for response
        return [
            {"name": name, "value": data["value"], "count": data["count"], "color": data["color"]}
            for name, data in categories.items()
            if data["count"] > 0 or name == "Other"
        ]

    @staticmethod
    async def get_active_sessions(db: AsyncSession):
        """Get list of users currently 'online' using real-time connections"""
        online_user_ids = manager.get_online_user_ids()
        if not online_user_ids:
            return []
            
        stmt = (
            select(User)
            .where(User.id.in_(online_user_ids))
            .options(defer(User.hashed_password))
            .options(selectinload(User.unit))
            .order_by(User.full_name.asc())
        )
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        # Attach session start times
        for user in users:
            start_time = manager.session_starts.get(user.id)
            if not start_time:
                # Fallback for already connected users
                start_time = user.last_seen or datetime.utcnow()
                manager.session_starts[user.id] = start_time
            user.session_start = start_time
            
        return users

    @staticmethod
    async def get_unit_distribution(db: AsyncSession):
        """Get number of users in each unit"""
        stmt = (
            select(Unit.name, func.count(User.id))
            .join(User, User.unit_id == Unit.id, isouter=True)
            .group_by(Unit.name)
        )
        result = await db.execute(stmt)
        return [{"name": name, "value": count} for name, count in result.all()]

    @staticmethod
    async def get_top_active_users(db: AsyncSession, limit: int = 5):
        """Get users with the most messages"""
        stmt = (
            select(User, func.count(Message.id).label("message_count"))
            .join(Message, Message.user_id == User.id)
            .options(selectinload(User.unit))
            .group_by(User.id)
            .order_by(text("message_count DESC"))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [{"user": user, "count": count} for user, count in result.all()]

    @staticmethod
    async def get_recent_activity(db: AsyncSession, limit: int = 10):
        """Get recent system events"""
        # We'll combine recent user joins and recent file uploads
        recent_users_stmt = select(User, text("'new_user' as type")).order_by(User.created_at.desc()).limit(limit)
        recent_docs_stmt = (
            select(Document, text("'new_document' as type"))
            .options(selectinload(Document.owner))
            .order_by(Document.created_at.desc())
            .limit(limit)
        )
        recent_tasks_stmt = (
            select(Task, text("'new_task_event' as type"))
            .options(selectinload(Task.issuer))
            .order_by(Task.created_at.desc())
            .limit(limit)
        )
        
        users_res = await db.execute(recent_users_stmt)
        docs_res = await db.execute(recent_docs_stmt)
        tasks_res = await db.execute(recent_tasks_stmt)
        
        events = []
        for user, type_name in users_res.all():
            events.append({
                "id": f"u_{user.id}",
                "type": type_name,
                "user": user.full_name or user.username,
                "description": f"Joined the platform",
                "timestamp": user.created_at
            })
            
        for doc, type_name in docs_res.all():
            events.append({
                "id": f"d_{doc.id}",
                "type": type_name,
                "user": doc.owner.full_name or doc.owner.username if doc.owner else "System",
                "description": f"Uploaded document: {doc.title}",
                "timestamp": doc.created_at
            })
            
        for task, type_name in tasks_res.all():
             events.append({
                "id": f"t_{task.id}",
                "type": type_name,
                "user": task.issuer.full_name or task.issuer.username if task.issuer else "System",
                "description": f"Created new task: {task.title}",
                "timestamp": task.created_at
            })
            
        events.sort(key=lambda x: x["timestamp"], reverse=True)
        return events[:limit]

    @staticmethod
    async def create_audit_log(
        db: AsyncSession, 
        user_id: int, 
        action: str, 
        target_type: str, 
        target_id: str = None, 
        details: str = None
    ):
        """Create a new audit log entry"""
        log = AuditLog(
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            details=details
        )
        db.add(log)
        await db.commit()
        return log

    @staticmethod
    async def get_audit_logs(db: AsyncSession, limit: int = 50):
        """Get list of audit logs"""
        stmt = (
            select(AuditLog)
            .options(
                selectinload(AuditLog.user).selectinload(User.unit)
            )
            .order_by(AuditLog.timestamp.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_system_health(app_state):
        """
        Get real-time system health metrics.
        Uses asyncio.to_thread for blocking psutil calls to avoid blocking event loop.
        """
        import asyncio
        import psutil
        from datetime import datetime
        
        # Calculate Uptime (non-blocking)
        start_time = getattr(app_state, "start_time", datetime.utcnow())
        uptime_delta = datetime.utcnow() - start_time
        
        days = uptime_delta.days
        hours, remainder = divmod(uptime_delta.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if days > 0:
            uptime_str = f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            uptime_str = f"{hours}h {minutes}m {seconds}s"
        else:
            uptime_str = f"{minutes}m {seconds}s"
        
        # Run blocking psutil calls in thread pool to avoid blocking event loop
        def get_cpu_ram():
            cpu_load = psutil.cpu_percent(interval=0.1)
            ram = psutil.virtual_memory()
            return cpu_load, ram.percent
        
        cpu_load, ram_usage = await asyncio.to_thread(get_cpu_ram)
        
        # Status
        status_str = "Normal"
        if cpu_load > 90 or ram_usage > 90:
            status_str = "Critical"
        elif cpu_load > 70 or ram_usage > 70:
            status_str = "Warning"
            
        return {
            "uptime": uptime_str,
            "cpu_load": cpu_load,
            "ram_usage": ram_usage,
            "status": status_str
        }

    @staticmethod
    async def get_task_unit_stats(db: AsyncSession):
        """Get task statistics by unit"""
        # We need to join Task with Assignee's Unit
        # Assignee is a User
        stmt = (
            select(
                Unit.name,
                func.count(Task.id).label("total"),
                func.count(Task.id).filter(Task.status == TaskStatus.COMPLETED).label("completed")
            )
            .select_from(Unit)
            .join(User, User.unit_id == Unit.id)
            .join(Task, Task.assignee_id == User.id)
            .group_by(Unit.name)
        )
        result = await db.execute(stmt)
        return [{"name": name, "total": total, "completed": completed} for name, total, completed in result.all()]

    @staticmethod
    async def get_all_tasks(db: AsyncSession):
        """Get all tasks for administrative view"""
        stmt = (
            select(Task)
            .options(
                selectinload(Task.issuer).selectinload(User.unit),
                selectinload(Task.assignee).selectinload(User.unit)
            )
            .order_by(Task.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()
