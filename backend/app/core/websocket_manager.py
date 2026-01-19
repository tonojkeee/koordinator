from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime
from fastapi import WebSocket
import logging
import asyncio

from app.core.redis_manager import redis_manager

logger = logging.getLogger(__name__)

# WebSocket compression settings
# Note: Actual compression support depends on the client and Starlette version
WS_COMPRESSION_OPTIONS = {
    # If using a compatible ASGI server with compression support
    # This enables permessage-deflate when available
}


class WebSocketManager:
    """
    Manage WebSocket connections with Redis pub/sub support.
    
    In multi-worker mode (with Redis):
    - Messages are published to Redis channels
    - Each worker subscribes and delivers to local connections
    
    In single-worker mode (without Redis):
    - Direct local delivery (original behavior)
    """
    
    def __init__(self) -> None:
        # channel_id -> list of (websocket, user_id) tuples
        self.active_connections: Dict[int, List[Tuple[WebSocket, int]]] = {}
        # channel_id -> set of user_ids (for quick unique count)
        self.channel_users: Dict[int, Set[int]] = {}
        # user_id -> list of websockets (for global user notifications)
        self.user_connections: Dict[int, List[WebSocket]] = {}
        # Local cache for session starts (synced with Redis)
        self._local_session_starts: Dict[int, datetime] = {}
        
    @property
    def session_starts(self) -> Dict[int, datetime]:
        """Get session starts (for backward compatibility)"""
        return self._local_session_starts
        
    async def init_redis(self, redis_url: Optional[str] = None) -> None:
        """Initialize Redis connection and subscribe to channels"""
        await redis_manager.connect(redis_url)
        
        if redis_manager.is_available:
            # Subscribe to broadcast channels
            await redis_manager.subscribe("ws:broadcast:all", self._handle_redis_broadcast_all)
            await redis_manager.subscribe("ws:broadcast:presence", self._handle_redis_presence)
            await redis_manager.start_listener()
            logger.info("WebSocket manager: Redis pub/sub initialized")
        else:
            logger.info("WebSocket manager: Using local-only mode (no Redis)")
            
    async def _handle_redis_broadcast_all(self, message: dict) -> None:
        """Handle broadcast messages from other workers"""
        exclude_user_id = message.pop("_exclude_user_id", None)
        await self._local_broadcast_to_all_users(message, exclude_user_id)
        
    async def _handle_redis_presence(self, message: dict) -> None:
        """Handle presence updates from other workers"""
        await self._local_broadcast_to_all_users(message)
    
    async def connect(self, websocket: WebSocket, channel_id: int, user_id: int) -> None:
        """
        Connect a websocket to a channel and broadcast presence.
        Accepts with compression support when available.
        """
        channel_id = int(channel_id)
        user_id = int(user_id)
        # Accept with default compression if client supports it
        await websocket.accept()
        
        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = []
            self.channel_users[channel_id] = set()
        self.active_connections[channel_id].append((websocket, user_id))
        self.channel_users[channel_id].add(user_id)
        
        # Broadcast presence update to all users in channel
        await self.broadcast_to_channel(channel_id, {
            "type": "presence",
            "online_count": len(self.channel_users[channel_id])
        })
    
    async def connect_user(self, websocket: WebSocket, user_id: int) -> None:
        """Connect a websocket to a user's global notification stream"""
        user_id = int(user_id)
        await websocket.accept()
        logger.debug(f"connect_user called for user {user_id}")
        
        is_first_connection = user_id not in self.user_connections
        
        if is_first_connection:
            self.user_connections[user_id] = []
            now = datetime.utcnow()
            self._local_session_starts[user_id] = now
            # Store in Redis for persistence across restarts
            await redis_manager.set_session_start(user_id, now)
            
        self.user_connections[user_id].append(websocket)
        logger.debug(f"User {user_id} connected. Total: {len(self.user_connections[user_id])}")
        
        if is_first_connection:
            await self.broadcast_to_all_users({
                "type": "user_presence",
                "user_id": user_id,
                "status": "online"
            })
    
    def get_online_user_ids(self) -> List[int]:
        """Get list of all online user IDs (users with global WebSocket connections)"""
        return [int(uid) for uid in self.user_connections.keys()]
    
    async def disconnect(self, websocket: WebSocket, channel_id: int, user_id: int):
        """Disconnect a websocket from a channel and broadcast presence"""
        channel_id = int(channel_id)
        user_id = int(user_id)
        
        if channel_id in self.active_connections:
            # Remove this specific websocket-user tuple
            self.active_connections[channel_id] = [
                (ws, uid) for ws, uid in self.active_connections[channel_id]
                if ws != websocket
            ]
            
            # Check if this user still has other connections to this channel
            remaining_user_connections = any(
                uid == user_id for ws, uid in self.active_connections[channel_id]
            )
            if not remaining_user_connections and channel_id in self.channel_users:
                self.channel_users[channel_id].discard(user_id)
            
            # Broadcast presence update
            online_count = len(self.channel_users.get(channel_id, set()))
            await self.broadcast_to_channel(channel_id, {
                "type": "presence",
                "online_count": online_count
            })
            
            # Clean up empty channel lists
            if not self.active_connections[channel_id]:
                del self.active_connections[channel_id]
                if channel_id in self.channel_users:
                    del self.channel_users[channel_id]
    
    async def disconnect_user(self, websocket: WebSocket, user_id: int):
        """Disconnect a global user notification connection"""
        user_id = int(user_id)
        
        if user_id in self.user_connections:
            try:
                self.user_connections[user_id].remove(websocket)
                logger.debug(f"User {user_id} disconnected. Remaining: {len(self.user_connections[user_id])}")
            except ValueError:
                pass
            
            # Clean up empty user lists
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                logger.debug(f"User {user_id} has no more connections. Waiting...")
                
                # Wait a short time to allow for reconnection
                await asyncio.sleep(2.0)
                
                # Check again if user is still offline
                if user_id not in self.user_connections:
                    logger.debug(f"User {user_id} still offline. Broadcasting...")
                    await self.broadcast_to_all_users({
                        "type": "user_presence",
                        "user_id": user_id,
                        "status": "offline"
                    })
                    # Clear session start
                    self._local_session_starts.pop(user_id, None)
                    await redis_manager.clear_session_start(user_id)

    async def kick_user(self, user_id: int):
        """Forcefully disconnect all WebSocket connections for a user"""
        user_id = int(user_id)
        
        # 1. Kick from global connections
        if user_id in self.user_connections:
            connections = list(self.user_connections[user_id])
            for ws in connections:
                try:
                    await ws.close(code=4003, reason="Account disabled")
                except Exception:
                    pass
        
        # 2. Kick from channel connections
        for channel_id, connections in list(self.active_connections.items()):
            for ws, uid in list(connections):
                if uid == user_id:
                    try:
                        await ws.close(code=4003, reason="Account disabled")
                    except Exception:
                        pass
    
    def get_online_count(self, channel_id: int) -> int:
        """Get number of unique online users in a channel"""
        return len(self.channel_users.get(channel_id, set()))
    
    async def broadcast_to_channel(self, channel_id: int, message: dict, exclude_websocket: WebSocket = None):
        """
        Broadcast a message to all connections in a channel.
        Uses parallel sending with asyncio.gather for performance.
        """
        if channel_id not in self.active_connections:
            return
            
        # Collect tasks for parallel execution
        tasks = []
        for ws, user_id in self.active_connections[channel_id]:
            if exclude_websocket and ws == exclude_websocket:
                continue
            tasks.append(self._safe_send(ws, message))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_to_user(self, user_id, message: dict):
        """Broadcast a message to all of a user's global notification connections"""
        try:
            uid_int = int(user_id)
        except (ValueError, TypeError):
            logger.error(f"Invalid user_id type for broadcast: {type(user_id)}")
            return

        connections = self.user_connections.get(uid_int, [])
        
        if connections:
            tasks = [self._safe_send(ws, message) for ws in connections]
            await asyncio.gather(*tasks, return_exceptions=True)
        else:
            logger.debug(f"No active connections found for user {user_id}")
    
    async def broadcast_to_all_users(self, message: dict, exclude_user_id=None):
        """
        Broadcast a message to ALL connected users across all workers.
        Uses Redis pub/sub for multi-worker support.
        """
        if redis_manager.is_available:
            # Publish to Redis for all workers to receive
            msg_with_meta = {**message, "_exclude_user_id": exclude_user_id}
            await redis_manager.publish("ws:broadcast:all", msg_with_meta)
        else:
            # Direct local broadcast
            await self._local_broadcast_to_all_users(message, exclude_user_id)
    
    async def _local_broadcast_to_all_users(self, message: dict, exclude_user_id=None):
        """
        Broadcast to all LOCAL connections.
        Uses parallel sending with asyncio.gather.
        """
        exclude_uid = None
        if exclude_user_id is not None:
            try:
                exclude_uid = int(exclude_user_id)
            except (ValueError, TypeError):
                pass

        logger.debug(f"Broadcast ALL: {message.get('type')} to {len(self.user_connections)} users")
        
        tasks = []
        for user_id, connections in list(self.user_connections.items()):
            if exclude_uid is not None and int(user_id) == exclude_uid:
                continue
            for ws in connections:
                tasks.append(self._safe_send(ws, message))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _safe_send(self, websocket: WebSocket, message: dict):
        """Safely send a message to a websocket, catching exceptions"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.debug(f"Error sending message: {e}")
    
    async def start_heartbeat(self):
        """Send periodic ping messages to keep connections alive"""
        while True:
            await asyncio.sleep(30)
            ping_message = {"type": "ping"}
            
            # Collect all tasks for parallel execution
            tasks = []
            
            # Ping global connections
            for user_id, connections in list(self.user_connections.items()):
                for ws in list(connections):
                    tasks.append(self._safe_send(ws, ping_message))
            
            # Ping channel connections
            for channel_id, connections in list(self.active_connections.items()):
                for ws, user_id in list(connections):
                    tasks.append(self._safe_send(ws, ping_message))
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    
    async def graceful_shutdown(self):
        """Close all connections gracefully on server shutdown"""
        logger.info("WebSocket manager: Initiating graceful shutdown...")
        
        tasks = []
        
        # Close global connections
        for user_id, connections in list(self.user_connections.items()):
            for ws in connections:
                tasks.append(self._safe_close(ws, 1001, "Server shutting down"))
        
        # Close channel connections
        for channel_id, connections in list(self.active_connections.items()):
            for ws, user_id in connections:
                tasks.append(self._safe_close(ws, 1001, "Server shutting down"))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
        logger.info(f"WebSocket manager: Closed {len(tasks)} connections")
    
    async def _safe_close(self, websocket: WebSocket, code: int, reason: str):
        """Safely close a websocket connection"""
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass


# Global instance
websocket_manager = WebSocketManager()
