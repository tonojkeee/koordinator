import pytest
from typing import Type
from dataclasses import dataclass
import asyncio

try:
    from app.core.events import Event, EventBus, event_bus
    EVENTS_MODULE_EXISTS = True
except ImportError:
    EVENTS_MODULE_EXISTS = False


@dataclass
class TestEvent:
    data: str


class TestEventBus:
    @pytest.mark.skipif(not EVENTS_MODULE_EXISTS, reason="events module not implemented yet")
    def test_event_bus_initializes_empty(self):
        bus = EventBus()
        assert bus._handlers == {}

    @pytest.mark.skipif(not EVENTS_MODULE_EXISTS, reason="events module not implemented yet")
    def test_subscribe_handler(self):
        bus = EventBus()
        handler_called = False

        async def handler(event: TestEvent):
            nonlocal handler_called
            handler_called = True

        bus.subscribe(TestEvent, handler)
        assert TestEvent in bus._handlers
        assert len(bus._handlers[TestEvent]) == 1

    @pytest.mark.skipif(not EVENTS_MODULE_EXISTS, reason="events module not implemented yet")
    def test_subscribe_multiple_handlers(self):
        bus = EventBus()

        async def handler1(event: TestEvent):
            pass

        async def handler2(event: TestEvent):
            pass

        bus.subscribe(TestEvent, handler1)
        bus.subscribe(TestEvent, handler2)

        assert len(bus._handlers[TestEvent]) == 2

    @pytest.mark.skipif(not EVENTS_MODULE_EXISTS, reason="events module not implemented yet")
    @pytest.mark.asyncio
    async def test_publish_calls_handler(self):
        bus = EventBus()
        results = []

        async def handler(event: TestEvent):
            results.append(event.data)

        bus.subscribe(TestEvent, handler)
        await bus.publish(TestEvent(data="test"))

        assert len(results) == 1
        assert results[0] == "test"

    @pytest.mark.skipif(not EVENTS_MODULE_EXISTS, reason="events module not implemented yet")
    @pytest.mark.asyncio
    async def test_publish_no_handlers(self):
        bus = EventBus()
        await bus.publish(TestEvent(data="test"))

    @pytest.mark.skipif(not EVENTS_MODULE_EXISTS, reason="events module not implemented yet")
    @pytest.mark.asyncio
    async def test_publish_calls_all_handlers(self):
        bus = EventBus()
        results = []

        async def handler1(event: TestEvent):
            results.append("handler1")

        async def handler2(event: TestEvent):
            results.append("handler2")

        bus.subscribe(TestEvent, handler1)
        bus.subscribe(TestEvent, handler2)
        await bus.publish(TestEvent(data="test"))

        assert results == ["handler1", "handler2"]


def test_events_module_exists():
    assert EVENTS_MODULE_EXISTS
