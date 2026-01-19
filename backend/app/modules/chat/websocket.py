from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime
from fastapi import WebSocket
import logging
import asyncio

from app.core.redis_manager import redis_manager
from app.core.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

# For backward compatibility, export the core manager as 'manager'
manager = websocket_manager
