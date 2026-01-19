from typing import Dict, List, Callable, Type
from dataclasses import dataclass
import asyncio


@dataclass
class Event:
    pass


class EventBus:
    def __init__(self):
        self._handlers: Dict[Type[Event], List[Callable]] = {}

    def subscribe(self, event_type: Type[Event], handler: Callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def publish(self, event: Event):
        handlers = self._handlers.get(type(event), [])
        for handler in handlers:
            await handler(event)


event_bus = EventBus()
