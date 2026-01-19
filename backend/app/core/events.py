from typing import Dict, List, Callable, Type, Awaitable
from dataclasses import dataclass, field
import asyncio


@dataclass(frozen=True)
class Event:
    pass


HandlerType = Callable[[Event], Awaitable[None]]


class EventBus:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._handlers: Dict[Type[Event], List[HandlerType]] = {}

    async def subscribe(self, event_type: Type[Event], handler: HandlerType):
        async with self._lock:
            if event_type not in self._handlers:
                self._handlers[event_type] = []
            if handler not in self._handlers[event_type]:
                self._handlers[event_type].append(handler)

    async def unsubscribe(self, event_type: Type[Event], handler: HandlerType):
        async with self._lock:
            if event_type in self._handlers:
                if handler in self._handlers[event_type]:
                    self._handlers[event_type].remove(handler)

    async def publish(self, event: Event):
        handlers = self._handlers.get(type(event), [])
        for handler in handlers:
            try:
                await handler(event)
            except Exception as e:
                print(f"Error in event handler: {e}")


event_bus = EventBus()
