"""
Redis Manager with fallback to in-memory storage.
Used for WebSocket pub/sub, rate limiting, and session management.
"""
import asyncio
import json
import logging
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RedisManager:
    """
    Redis connection manager with automatic fallback to in-memory storage.
    
    When Redis is unavailable:
    - Pub/Sub falls back to local asyncio events (single-process only)
    - Rate limiting works per-process only
    - Session data stays in memory
    """
    
    def __init__(self) -> None:
        self._redis = None
        self._pubsub = None
        self._is_connected = False
        self._fallback_mode = False
        
        # In-memory fallback storage
        self._memory_cache: Dict[str, Any] = {}
        self._memory_expiry: Dict[str, datetime] = {}
        self._local_subscribers: Dict[str, List[Callable]] = {}
        
    async def connect(self, redis_url: Optional[str] = None) -> None:
        """Initialize Redis connection or fallback to in-memory mode"""
        if not redis_url:
            logger.warning("REDIS_URL not configured, using in-memory fallback (single-process mode)")
            self._fallback_mode = True
            return
            
        try:
            import redis.asyncio as aioredis
            self._redis = await aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )
            # Test connection
            await self._redis.ping()
            self._is_connected = True
            self._fallback_mode = False
            logger.info(f"Connected to Redis: {redis_url.split('@')[-1] if '@' in redis_url else redis_url}")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using in-memory fallback.")
            self._fallback_mode = True
            self._redis = None
            
    async def disconnect(self) -> None:
        """Close Redis connection"""
        if self._redis:
            await self._redis.close()
            self._is_connected = False
            
    @property
    def is_available(self) -> bool:
        """Check if Redis is connected and available"""
        return self._is_connected and not self._fallback_mode
    
    # ==================== Key-Value Operations ====================
    
    async def get(self, key: str) -> Optional[str]:
        """Get value by key"""
        if self._fallback_mode:
            self._cleanup_expired()
            return self._memory_cache.get(key)
        try:
            return await self._redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return self._memory_cache.get(key)
            
    async def set(self, key: str, value: str, ex: Optional[int] = None) -> None:
        """Set value with optional expiration (seconds)"""
        if self._fallback_mode:
            self._memory_cache[key] = value
            if ex:
                self._memory_expiry[key] = datetime.utcnow() + timedelta(seconds=ex)
            return
        try:
            await self._redis.set(key, value, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            self._memory_cache[key] = value
            if ex:
                self._memory_expiry[key] = datetime.utcnow() + timedelta(seconds=ex)
                
    async def delete(self, key: str) -> None:
        """Delete a key"""
        if self._fallback_mode:
            self._memory_cache.pop(key, None)
            self._memory_expiry.pop(key, None)
            return
        try:
            await self._redis.delete(key)
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            self._memory_cache.pop(key, None)
            
    async def incr(self, key: str) -> int:
        """Increment value and return new value"""
        if self._fallback_mode:
            self._cleanup_expired()
            val = int(self._memory_cache.get(key, 0)) + 1
            self._memory_cache[key] = str(val)
            return val
        try:
            return await self._redis.incr(key)
        except Exception as e:
            logger.error(f"Redis INCR error: {e}")
            val = int(self._memory_cache.get(key, 0)) + 1
            self._memory_cache[key] = str(val)
            return val
            
    async def expire(self, key: str, seconds: int) -> None:
        """Set key expiration"""
        if self._fallback_mode:
            self._memory_expiry[key] = datetime.utcnow() + timedelta(seconds=seconds)
            return
        try:
            await self._redis.expire(key, seconds)
        except Exception as e:
            logger.error(f"Redis EXPIRE error: {e}")
            self._memory_expiry[key] = datetime.utcnow() + timedelta(seconds=seconds)
            
    async def ttl(self, key: str) -> int:
        """Get remaining TTL for a key"""
        if self._fallback_mode:
            if key in self._memory_expiry:
                remaining = (self._memory_expiry[key] - datetime.utcnow()).total_seconds()
                return max(0, int(remaining))
            return -1
        try:
            return await self._redis.ttl(key)
        except Exception as e:
            logger.error(f"Redis TTL error: {e}")
            return -1
            
    # ==================== Hash Operations ====================
    
    async def hset(self, name: str, key: str, value: str):
        """Set hash field"""
        if self._fallback_mode:
            if name not in self._memory_cache:
                self._memory_cache[name] = {}
            self._memory_cache[name][key] = value
            return
        try:
            await self._redis.hset(name, key, value)
        except Exception as e:
            logger.error(f"Redis HSET error: {e}")
            if name not in self._memory_cache:
                self._memory_cache[name] = {}
            self._memory_cache[name][key] = value
            
    async def hget(self, name: str, key: str) -> Optional[str]:
        """Get hash field"""
        if self._fallback_mode:
            return self._memory_cache.get(name, {}).get(key)
        try:
            return await self._redis.hget(name, key)
        except Exception as e:
            logger.error(f"Redis HGET error: {e}")
            return self._memory_cache.get(name, {}).get(key)
            
    async def hdel(self, name: str, key: str):
        """Delete hash field"""
        if self._fallback_mode:
            if name in self._memory_cache:
                self._memory_cache[name].pop(key, None)
            return
        try:
            await self._redis.hdel(name, key)
        except Exception as e:
            logger.error(f"Redis HDEL error: {e}")
            if name in self._memory_cache:
                self._memory_cache[name].pop(key, None)
                
    async def hgetall(self, name: str) -> Dict[str, str]:
        """Get all hash fields"""
        if self._fallback_mode:
            return self._memory_cache.get(name, {})
        try:
            return await self._redis.hgetall(name)
        except Exception as e:
            logger.error(f"Redis HGETALL error: {e}")
            return self._memory_cache.get(name, {})
    
    # ==================== Pub/Sub Operations ====================
    
    async def publish(self, channel: str, message: dict):
        """Publish message to channel"""
        msg_str = json.dumps(message)
        
        if self._fallback_mode:
            # Local event dispatch
            if channel in self._local_subscribers:
                for callback in self._local_subscribers[channel]:
                    try:
                        asyncio.create_task(callback(message))
                    except Exception as e:
                        logger.error(f"Local pub/sub callback error: {e}")
            return
            
        try:
            await self._redis.publish(channel, msg_str)
        except Exception as e:
            logger.error(f"Redis PUBLISH error: {e}")
            # Fallback to local
            if channel in self._local_subscribers:
                for callback in self._local_subscribers[channel]:
                    asyncio.create_task(callback(message))
                    
    async def subscribe(self, channel: str, callback: Callable):
        """Subscribe to channel with callback"""
        if self._fallback_mode:
            if channel not in self._local_subscribers:
                self._local_subscribers[channel] = []
            self._local_subscribers[channel].append(callback)
            return
            
        # For Redis, we need to start a listener task
        if not self._pubsub:
            self._pubsub = self._redis.pubsub()
            
        try:
            await self._pubsub.subscribe(channel)
            # Store callback for this channel
            if channel not in self._local_subscribers:
                self._local_subscribers[channel] = []
            self._local_subscribers[channel].append(callback)
        except Exception as e:
            logger.error(f"Redis SUBSCRIBE error: {e}")
            
    async def start_listener(self):
        """Start Redis pub/sub listener loop"""
        if self._fallback_mode or not self._pubsub:
            return
            
        async def listen():
            try:
                async for message in self._pubsub.listen():
                    if message["type"] == "message":
                        channel = message["channel"]
                        data = json.loads(message["data"])
                        if channel in self._local_subscribers:
                            for callback in self._local_subscribers[channel]:
                                asyncio.create_task(callback(data))
            except Exception as e:
                logger.error(f"Redis listener error: {e}")
                
        asyncio.create_task(listen())
        
    # ==================== Rate Limiting ====================
    
    async def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """
        Check if rate limit is exceeded.
        Returns True if allowed, False if rate limited.
        """
        rate_key = f"rate:{key}"
        
        count = await self.incr(rate_key)
        if count == 1:
            await self.expire(rate_key, window_seconds)
            
        return count <= max_requests
        
    async def get_rate_limit_remaining(self, key: str, max_requests: int) -> int:
        """Get remaining requests in current window"""
        rate_key = f"rate:{key}"
        current = await self.get(rate_key)
        if current is None:
            return max_requests
        return max(0, max_requests - int(current))
    
    # ==================== Session Management ====================
    
    async def set_session_start(self, user_id: int, timestamp: datetime):
        """Store session start time"""
        await self.hset("session_starts", str(user_id), timestamp.isoformat())
        
    async def get_session_start(self, user_id: int) -> Optional[datetime]:
        """Get session start time"""
        ts = await self.hget("session_starts", str(user_id))
        if ts:
            return datetime.fromisoformat(ts)
        return None
        
    async def clear_session_start(self, user_id: int):
        """Clear session start time"""
        await self.hdel("session_starts", str(user_id))
        
    async def get_all_session_starts(self) -> Dict[int, datetime]:
        """Get all session start times"""
        data = await self.hgetall("session_starts")
        return {int(k): datetime.fromisoformat(v) for k, v in data.items()}
    
    # ==================== Helpers ====================
    
    def _cleanup_expired(self):
        """Remove expired keys from in-memory storage"""
        now = datetime.utcnow()
        expired = [k for k, v in self._memory_expiry.items() if v < now]
        for k in expired:
            self._memory_cache.pop(k, None)
            self._memory_expiry.pop(k, None)


# Singleton instance
redis_manager = RedisManager()
