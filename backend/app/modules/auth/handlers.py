from typing import Any, Dict
from app.core.events import event_bus
from app.modules.auth.events import UserCreated, UserDeleted, UserUpdated
import logging

logger = logging.getLogger(__name__)

class UserEventHandlers:
    """Handlers for user events using Event Bus (Task 2.1)"""

    @staticmethod
    def on_user_created(user_id: int, email: str, username: str):
        logger.info(f"User created: {user_id}, email: {email}, username: {username}")
        # TODO: Emit UserCreated event to bus when user is created
        # event_bus.publish(UserCreated(user_id=user_id, email=email, username=username))
        # TODO: Notify via WebSocket Manager
        # await websocket_manager.broadcast_to_user(user_id, {"type": "user.created", "user_id": user_id})

    @staticmethod
    def on_user_updated(user_id: int, changes: Dict[str, Any]):
        logger.info(f"User updated: {user_id}, changes: {changes}")
        # TODO: Emit UserUpdated event to bus
        # event_bus.publish(UserUpdated(user_id=user_id, changes=changes))
        # TODO: Notify via WebSocket Manager
        # await websocket_manager.broadcast_to_user(user_id, {"type": "user.updated", "user_id": user_id, "changes": changes})

    @staticmethod
    def on_user_deleted(user_id: int):
        logger.warning(f"User deleted: {user_id}")
        # TODO: Emit UserDeleted event to bus
        # event_bus.publish(UserDeleted(user_id=user_id))
        # TODO: Notify via WebSocket Manager
        # await websocket_manager.broadcast_to_user(user_id, {"type": "user.deleted", "user_id": user_id})
