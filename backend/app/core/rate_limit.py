"""
Rate Limiting Module

Provides rate limiting for API endpoints to prevent abuse and DoS attacks.
Uses Redis when available, falls back to in-memory storage.
"""

from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.redis_manager import redis_manager
from app.modules.admin.service import SystemSettingService

# In-memory fallback when Redis is unavailable
_local_rate_limits: dict = defaultdict(list)


class RateLimiter:
    """Rate limiting for API endpoints"""
    
    @staticmethod
    async def check_limit(
        key: str,
        max_requests: int,
        window_seconds: int = 60
    ) -> bool:
        """
        Check if rate limit is exceeded.
        
        Args:
            key: Unique identifier for rate limit (e.g., "login:192.168.1.1")
            max_requests: Maximum number of requests allowed in window
            window_seconds: Time window in seconds (default 60)
            
        Returns:
            True if request is allowed, False if rate limited
        """
        # Use Redis if available
        if redis_manager.is_available:
            return await redis_manager.check_rate_limit(
                key, max_requests, window_seconds
            )
        
        # Fallback to in-memory rate limiting
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_seconds)
        
        # Clean old entries
        _local_rate_limits[key] = [
            t for t in _local_rate_limits[key] if t > cutoff
        ]
        
        if len(_local_rate_limits[key]) >= max_requests:
            return False
        
        _local_rate_limits[key].append(now)
        return True
    
    @staticmethod
    async def get_remaining(
        key: str,
        max_requests: int
    ) -> int:
        """Get remaining requests in current window"""
        if redis_manager.is_available:
            return await redis_manager.get_rate_limit_remaining(key, max_requests)
        
        # Fallback to in-memory
        return max(0, max_requests - len(_local_rate_limits.get(key, [])))


async def rate_limit_auth(request: Request) -> None:
    """
    Rate limit authentication endpoints (login, register, password reset).
    Limit: 5 requests per minute per IP address.
    
    Raises:
        HTTPException: If rate limit is exceeded
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"auth:{client_ip}"
    
    if not await RateLimiter.check_limit(key, max_requests=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток. Пожалуйста, подождите минуту.",
            headers={"Retry-After": "60"}
        )


async def rate_limit_api(request: Request) -> None:
    """
    Rate limit general API endpoints.
    Limit: 100 requests per minute per IP address.
    
    Raises:
        HTTPException: If rate limit is exceeded
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"api:{client_ip}"
    
    if not await RateLimiter.check_limit(key, max_requests=100, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много запросов. Пожалуйста, подождите.",
            headers={"Retry-After": "60"}
        )


async def rate_limit_file_upload(request: Request) -> None:
    """
    Rate limit file upload endpoints.
    Limit: 10 uploads per minute per IP address.
    
    Raises:
        HTTPException: If rate limit is exceeded
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"upload:{client_ip}"
    
    if not await RateLimiter.check_limit(key, max_requests=10, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много загрузок. Пожалуйста, подождите.",
            headers={"Retry-After": "60"}
        )


async def rate_limit_websocket(user_id: int, db: AsyncSession) -> bool:
    """
    Rate limit WebSocket connections.
    Limit: 3 connections per minute per user.
    
    Args:
        user_id: User ID
        db: Database session
        
    Returns:
        True if connection is allowed, False if rate limited
    """
    key = f"ws_connect:{user_id}"
    return await RateLimiter.check_limit(key, max_requests=3, window_seconds=60)


async def rate_limit_chat_message(user_id: int, db: AsyncSession) -> bool:
    """
    Rate limit chat messages.
    Limit: Configurable via system settings (default 60 per minute).
    
    Args:
        user_id: User ID
        db: Database session
        
    Returns:
        True if message is allowed, False if rate limited
    """
    # Get limit from system settings
    limit = await SystemSettingService.get_value(db, "chat_rate_limit")
    try:
        max_messages = int(limit)
    except (ValueError, TypeError):
        max_messages = 60  # Default
    
    key = f"chat:{user_id}"
    return await RateLimiter.check_limit(key, max_requests=max_messages, window_seconds=60)
