"""
Celery Application Configuration.

This module configures Celery for background task processing.
Used for:
- Email processing (SMTP)
- File cleanup operations  
- Heavy data processing
- Scheduled tasks

Start worker: celery -A app.core.celery_app worker --loglevel=info
Start beat:   celery -A app.core.celery_app beat --loglevel=info
"""
import os
from celery import Celery
from app.core.config import get_settings

settings = get_settings()


def get_celery_broker_url() -> str:
    """
    Get Celery broker URL.
    Uses Redis if configured, otherwise falls back to filesystem broker.
    """
    if settings.redis_url:
        return settings.redis_url
    # Fallback to filesystem broker for development
    return "filesystem://"


def get_celery_result_backend() -> str:
    """Get Celery result backend URL."""
    if settings.redis_url:
        return settings.redis_url
    # Fallback to filesystem for development
    return "file:///tmp/celery-results"


# Create Celery app
celery_app = Celery(
    "koordinator",
    broker=get_celery_broker_url(),
    backend=get_celery_result_backend(),
    include=[
        "app.core.tasks",
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
    
    # Result settings
    result_expires=3600,  # 1 hour
    
    # Beat scheduler (for periodic tasks)
    beat_schedule={
        "cleanup-expired-sessions": {
            "task": "app.core.tasks.cleanup_expired_sessions",
            "schedule": 3600.0,  # Every hour
        },
    },
)

# Configure filesystem broker paths if not using Redis
if not settings.redis_url:
    broker_dir = "/tmp/celery-broker"
    os.makedirs(f"{broker_dir}/out", exist_ok=True)
    os.makedirs(f"{broker_dir}/processed", exist_ok=True)
    celery_app.conf.update(
        broker_transport_options={
            "data_folder_in": f"{broker_dir}/out",
            "data_folder_out": f"{broker_dir}/out",
            "data_folder_processed": f"{broker_dir}/processed",
        }
    )
