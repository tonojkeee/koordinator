from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import AsyncIterator, Any

from fastapi.staticfiles import StaticFiles
import os
import logging
from app.core.config import get_settings
from app.core.database import init_db, engine, get_db
from app.core.events import event_bus
from app.modules.auth.router import router as auth_router
from app.modules.chat.router import router as chat_router
from app.modules.board.router import router as board_router
from app.modules.archive.router import router as archive_router
from app.modules.admin.router import router as admin_router
from app.modules.tasks.router import router as tasks_router
from app.modules.email.router import router as email_router
from app.modules.zsspd.router import router as zsspd_router
import socket
from zeroconf.asyncio import AsyncZeroconf
from zeroconf import ServiceInfo

settings = get_settings()
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Lifespan events"""
    
    # Security validation - SECRET_KEY
    if not settings.secret_key or settings.secret_key == "your-secret-key-change-in-production":
        if not settings.debug:
            raise RuntimeError(
                "CRITICAL: SECRET_KEY must be configured in production! "
                "Set the SECRET_KEY environment variable."
            )
        else:
            logger.warning(
                "SECURITY WARNING: SECRET_KEY is not configured. "
                "This is acceptable for development but MUST be set in production!"
            )
    
    # Security validation - CORS
    if not settings.cors_origins or "*" in settings.cors_origins:
        if not settings.debug:
            logger.warning(
                "SECURITY WARNING: CORS is not properly configured for production! "
                "Set CORS_ORIGINS environment variable with allowed domains."
            )
        else:
            logger.info("Development mode: CORS accepting all origins")
    
    # ========== STARTUP ==========
    
    # Initialize database
    await init_db()
    app.state.engine = engine

    # Seed database with default data
    from scripts import seed_db
    await seed_db.main()
    
    from datetime import datetime
    app.state.start_time = datetime.utcnow()
    
    # Initialize Redis (optional, for scaling)
    from app.modules.chat.websocket import manager
    await manager.init_redis(settings.redis_url if settings.redis_url else None)
    
    # Start WebSocket heartbeat
    import asyncio
    asyncio.create_task(manager.start_heartbeat())

    # Start SMTP Server in background thread
    from app.modules.email.smtp_server import SMTPServerManager
    import threading

    smtp_server = SMTPServerManager(hostname="0.0.0.0", port=2525)
    smtp_thread = threading.Thread(target=smtp_server.start, daemon=True)
    smtp_thread.start()
    logger.info("SMTP Server started in background thread on 0.0.0.0:2525")

    # Register event handlers
    from app.modules.chat.handlers import register_event_handlers
    await register_event_handlers(event_bus)

    # Log startup info
    db_type = "MySQL" if settings.is_mysql else "SQLite"
    redis_status = "connected" if settings.redis_url else "disabled (in-memory mode)"
    logger.info(f"Server started: Database={db_type}, Redis={redis_status}")
    
    # Register mDNS service for auto-discovery
    app.state.zeroconf = AsyncZeroconf()
    try:
        local_hostname = socket.gethostname()
        # More reliable way to get the primary network IP (works with 127.0.1.1 too)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # doesn't even have to be reachable
            s.connect(('10.255.255.255', 1))
            local_ip = s.getsockname()[0]
        except Exception:
            local_ip = socket.gethostbyname(local_hostname)
        finally:
            s.close()
                
        info = ServiceInfo(
            "_koordinator._tcp.local.",
            f"{local_hostname}._koordinator._tcp.local.",
            addresses=[socket.inet_aton(local_ip)],
            port=5100,
            properties={
                "version": settings.app_version,
                "name": settings.app_name,
                "path": "/api",
                "protocol": "https" if settings.use_https else "http",
                "domain": settings.server_domain
            },
            server=settings.server_domain if settings.server_domain else f"{local_hostname}.local."
        )
        await app.state.zeroconf.async_register_service(info)
        app.state.zc_info = info
        logger.info(f"mDNS: Service registered as {settings.app_name} at {local_ip}:5100")
    except Exception:
        logger.exception("mDNS: Failed to register service")
    
    yield
    
    # ========== SHUTDOWN ==========
    
    # Graceful WebSocket shutdown
    await manager.graceful_shutdown()
    
    # Stop SMTP server
    smtp_server.stop()
    
    # Close Redis connection
    from app.core.redis_manager import redis_manager
    await redis_manager.disconnect()
    
    # Dispose database engine
    await engine.dispose()
    
    # Unregister mDNS service
    if hasattr(app.state, "zeroconf"):
        try:
            if hasattr(app.state, "zc_info"):
                await app.state.zeroconf.async_unregister_service(app.state.zc_info)
            await app.state.zeroconf.async_close()
            logger.info("mDNS: Service unregistered")
        except Exception as e:
            logger.error(f"mDNS: Error during unregistration: {e}")
            
    logger.info("Server shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan
)

# CORS - in debug mode allow all origins, otherwise use configured origins
cors_origins = settings.cors_origins if settings.cors_origins else (["*"] if settings.debug else [])

# Security validation: Ensure no wildcard in production
if not settings.debug and "*" in cors_origins:
    logger.error(
        "SECURITY ERROR: Wildcard CORS origin (*) is not allowed in production! "
        "Set CORS_ORIGINS environment variable with specific allowed domains."
    )
    raise RuntimeError("Wildcard CORS origin not allowed in production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID middleware for tracing
from uuid import uuid4
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # X-Content-Type-Options: Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-Frame-Options: Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # X-XSS-Protection: Enable XSS filter (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer-Policy: Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy: Control browser features
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )
        
        # Strict-Transport-Security: Enforce HTTPS (only in production with HTTPS)
        if settings.use_https and not settings.debug:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
        
        # Content-Security-Policy: Strict policy for API responses
        if request.url.path.startswith("/api"):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        
        return response


app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(board_router, prefix="/api")
app.include_router(archive_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(email_router, prefix="/api")
app.include_router(zsspd_router, prefix="/api")

# Prometheus metrics
from prometheus_fastapi_instrumentator import Instrumentator

# Initialize and expose metrics at /metrics endpoint
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/health", "/metrics", "/api/health", "/api/metrics"],
    inprogress_name="http_requests_inprogress",
    inprogress_labels=True,
)
instrumentator.instrument(app).expose(app, endpoint="/api/metrics", include_in_schema=False)
instrumentator.expose(app, endpoint="/metrics", include_in_schema=False) # Keep legacy endpoint too

# Static files for avatars
if not os.path.exists("static/avatars"):
    os.makedirs("static/avatars", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint"""
    return {"message": "ГИС «КООРДИНАТОР» API", "version": settings.app_version, "status": "running"}


@app.get("/health")
@app.get("/api/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """
    Health check endpoint with database connectivity test.
    Returns detailed status for monitoring systems.
    """
    from app.core.redis_manager import redis_manager
    
    health_status = {
        "status": "healthy",
        "version": settings.app_version,
        "database": {
            "type": "mysql" if settings.is_mysql else "sqlite",
            "status": "unknown"
        },
        "redis": {
            "enabled": bool(settings.redis_url),
            "status": "connected" if redis_manager.is_available else "fallback"
        }
    }
    
    # Test database connection
    try:
        await db.execute(text("SELECT 1"))
        health_status["database"]["status"] = "connected"
    except Exception as e:
        # Log detailed error internally for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Health check database error: {e}", exc_info=True)
        # Return generic status to client (no error details)
        health_status["database"]["status"] = "error"
        health_status["status"] = "degraded"
    
    return health_status
