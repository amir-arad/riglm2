# Messaging & Notifications

[← Back to Index](index.md)

---

## Overview

Magg aggregates notifications from all backend MCP servers and routes them to registered handlers. This enables real-time updates when tools, resources, or prompts change.

---

## Architecture

```
Backend MCP Server
        │
        ▼
┌───────────────────────────────┐
│ BackendMessageHandler         │  ← One per mounted server
│ (attached to Client)          │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ ServerMessageCoordinator      │  ← Aggregates all notifications
│ - Tracks notification state   │
│ - Wraps in ServerNotification │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ MessageRouter                 │  ← Routes to handlers
│ - Global handlers             │
│ - Per-server handlers         │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ MaggMessageHandler            │  ← Client-side handler
│ (or custom handler)           │
└───────────────────────────────┘
        │
        ▼
    User callback
```

---

## Notification Types

| Type | When Fired |
|------|------------|
| `ToolListChangedNotification` | Tools added/removed on backend |
| `ResourceListChangedNotification` | Resources changed |
| `PromptListChangedNotification` | Prompts changed |
| `ProgressNotification` | Long-running operation progress |
| `LoggingMessageNotification` | Backend log messages |

---

## Key Classes

### MessageRouter

Routes messages to registered handlers.

```python
class MessageRouter:
    async def register_handler(
        self,
        handler: MessageHandler,
        server_id: str | None = None  # None = global
    ) -> None

    async def unregister_handler(
        self,
        handler: MessageHandler,
        server_id: str | None = None
    ) -> None

    async def route_message(
        self,
        message: Any,
        server_id: str | None = None
    ) -> None
```

### ServerMessageCoordinator

Aggregates and tracks notifications from backends.

```python
class ServerMessageCoordinator:
    async def handle_tool_list_changed(
        self,
        notification: ToolListChangedNotification,
        server_id: str
    ) -> None

    async def handle_resource_list_changed(...)
    async def handle_prompt_list_changed(...)
    async def handle_progress(...)
    async def handle_logging_message(...)

    async def get_notification_state(self) -> dict[str, Any]
```

### BackendMessageHandler

Forwards notifications from a specific backend.

```python
class BackendMessageHandler(MessageHandler):
    def __init__(self, server_id: str, coordinator: ServerMessageCoordinator)

    async def on_tool_list_changed(notification) -> None
    async def on_resource_list_changed(notification) -> None
    async def on_prompt_list_changed(notification) -> None
    async def on_progress(notification) -> None
    async def on_logging_message(notification) -> None
```

### MaggMessageHandler

Client-side handler with callbacks.

```python
class MaggMessageHandler(MessageHandler):
    def __init__(
        self,
        on_tool_list_changed: Callable | None = None,
        on_resource_list_changed: Callable | None = None,
        on_prompt_list_changed: Callable | None = None,
        on_progress: Callable | None = None,
        on_logging_message: Callable | None = None,
        on_message: Callable | None = None,  # Catch-all
    )
```

---

## Usage Examples

### Register Global Handler

```python
# Custom handler
class MyHandler(MessageHandler):
    async def on_tool_list_changed(self, notification):
        print(f"Tools changed!")

    async def on_message(self, message):
        print(f"Any message: {message}")

# Register globally (receives from all servers)
handler = MyHandler()
await mcp._message_router.register_handler(handler, server_id=None)
```

### Register Per-Server Handler

```python
# Only receive from "playwright" server
await mcp._message_router.register_handler(handler, server_id="playwright")
```

### Using MaggMessageHandler

```python
from magg.messaging import MaggMessageHandler
from magg.client import MaggClient

def on_tools_changed(notification):
    print("Tools changed, refreshing...")

handler = MaggMessageHandler(
    on_tool_list_changed=on_tools_changed,
    on_progress=lambda p: print(f"Progress: {p}")
)

async with MaggClient("http://localhost:8000/mcp", message_handler=handler) as client:
    tools = await client.list_tools()
    # Handler will be called when tools change
```

### Inspect Notification State

```python
# Get current tracking state (for debugging)
state = await mcp._message_coordinator.get_notification_state()
# Returns: {'tool_changes': {'server1', 'server2'}, ...}
```

---

## Handler Registration Points

| Location | Purpose |
|----------|---------|
| `ProxyFastMCP.register_client_message_handler()` | Register client handler |
| `ProxyFastMCP.unregister_client_message_handler()` | Unregister handler |
| `mcp._message_router.register_handler()` | Direct router access |

---

## Message Flow Details

### Tool List Changed

```python
# 1. Backend emits notification
# 2. Client transport receives it
# 3. BackendMessageHandler.on_tool_list_changed() called
async def on_tool_list_changed(self, notification):
    await self.coordinator.handle_tool_list_changed(notification, self.server_id)

# 4. Coordinator tracks and routes
async def handle_tool_list_changed(self, notification, server_id):
    async with self._lock:
        self._notification_state.setdefault("tool_changes", set()).add(server_id)
        server_notification = mcp.types.ServerNotification(root=notification)
        await self.router.route_message(server_notification, server_id)

# 5. Router dispatches to handlers
async def route_message(self, message, server_id):
    handlers = self._global_handlers.copy()
    if server_id in self._handlers:
        handlers.extend(self._handlers[server_id])

    await asyncio.gather(
        *[handler(message) for handler in handlers],
        return_exceptions=True  # Silent failure
    )
```

---

## Error Handling

Handlers are called via `asyncio.gather(..., return_exceptions=True)`:

- Handler exceptions are caught and logged
- Other handlers continue executing
- No backpressure or circuit breaker

```python
# In MaggMessageHandler
async def on_tool_list_changed(self, notification):
    if self._on_tool_list_changed:
        try:
            result = self._on_tool_list_changed(notification)
            if asyncio.iscoroutine(result):
                await result
        except Exception as e:
            logger.error("Error in tool list changed handler: %s", e)
```

---

## Integration Pattern

```python
# Custom integration with riglm2
class Riglm2Handler(MaggMessageHandler):
    def __init__(self, coordinator):
        super().__init__(
            on_tool_list_changed=self._on_tools_changed,
            on_progress=self._on_progress,
        )
        self.coordinator = coordinator

    def _on_tools_changed(self, notification):
        # Notify riglm2 core of capability changes
        self.coordinator.refresh_capabilities()

    def _on_progress(self, notification):
        # Forward progress to riglm2 UI
        self.coordinator.update_progress(notification)
```
