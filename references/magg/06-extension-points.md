# Extension Points

[← Back to Index](index.md)

---

## Overview

Magg lacks a formal plugin API. Extension is primarily through:
1. Message handlers (official)
2. Subclassing (semi-official)
3. Monkey-patching (unofficial)

---

## Official Extension Points

### 1. Message Handler System

Register handlers to receive notifications from backends.

```python
from fastmcp.client.messages import MessageHandler

class MyHandler(MessageHandler):
    async def on_tool_list_changed(self, notification):
        # React to tool changes
        pass

    async def on_message(self, message):
        # Catch-all
        pass

# Global handler (all servers)
await mcp._message_router.register_handler(handler, server_id=None)

# Per-server handler
await mcp._message_router.register_handler(handler, server_id="playwright")
```

### 2. MaggMessageHandler Callbacks

```python
from magg.messaging import MaggMessageHandler

handler = MaggMessageHandler(
    on_tool_list_changed=lambda n: print("Tools changed"),
    on_resource_list_changed=lambda n: print("Resources changed"),
    on_prompt_list_changed=lambda n: print("Prompts changed"),
    on_progress=lambda n: print(f"Progress: {n}"),
    on_logging_message=lambda n: print(f"Log: {n}"),
    on_message=lambda m: print(f"Any: {m}"),  # Catch-all
)
```

### 3. Config Reload Callback

```python
from magg.reload import ConfigChange

async def my_reload_handler(config_change: ConfigChange):
    for change in config_change.server_changes:
        print(f"Action: {change.action}, Server: {change.name}")

await config_manager.setup_config_reload(my_reload_handler)
```

---

## Subclassing Extension Points

### 1. ProxyFastMCP Subclass

Override proxy behavior:

```python
from magg.proxy.server import ProxyFastMCP

class MyProxyFastMCP(ProxyFastMCP):
    async def _proxy_tool(self, action, a_type, args, path, **kwargs):
        # Pre-processing
        print(f"Proxy call: {action} {a_type} {path}")

        result = await super()._proxy_tool(action, a_type, args, path, **kwargs)

        # Post-processing
        return result

    async def _proxy_list(self, capability_type):
        result, result_type = await super()._proxy_list(capability_type)
        # Filter or transform
        return result, result_type

    @classmethod
    def validate_operation(cls, action, a_type):
        # Add custom validation
        super().validate_operation(action, a_type)
```

### 2. ConfigReloader Subclass

Add metrics/logging:

```python
from magg.reload import ConfigReloader
import time

class MetricsConfigReloader(ConfigReloader):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.reload_count = 0
        self.last_reload_time = None
        self.failed_reloads = 0

    async def reload_config(self):
        start = time.time()
        result = await super().reload_config()

        self.reload_count += 1
        self.last_reload_time = time.time() - start
        if result is None:
            self.failed_reloads += 1

        return result
```

### 3. ServerManager Subclass

Custom mount/unmount behavior:

```python
from magg.server.manager import ServerManager

class MyServerManager(ServerManager):
    async def mount_server(self, server):
        print(f"Mounting: {server.name}")
        result = await super().mount_server(server)
        if result:
            print(f"Mounted: {server.name}")
        return result

    async def unmount_server(self, name):
        print(f"Unmounting: {name}")
        return await super().unmount_server(name)
```

---

## Monkey-Patching Extension Points

### 1. Tool Call Instrumentation

```python
from magg.proxy.server import ProxyFastMCP
import time

original_proxy_tool = ProxyFastMCP._proxy_tool

async def instrumented_proxy_tool(self, action, a_type, args, path, **kwargs):
    start = time.time()
    try:
        result = await original_proxy_tool(self, action, a_type, args, path, **kwargs)
        duration = time.time() - start
        # Record metrics
        print(f"SUCCESS: {action} {a_type} {path} in {duration:.3f}s")
        return result
    except Exception as e:
        # Record failure
        print(f"FAILURE: {action} {a_type} {path} - {e}")
        raise

ProxyFastMCP._proxy_tool = instrumented_proxy_tool
```

### 2. Transport Customization

```python
from magg.util import transport

original_get_transport = transport.get_transport_for_command

def my_get_transport(command, args, env, cwd, transport_config):
    if command == "my-custom-mcp":
        return MyCustomTransport(...)
    return original_get_transport(command, args, env, cwd, transport_config)

transport.get_transport_for_command = my_get_transport
```

### 3. Config Load Interception

```python
from magg.reload import ConfigReloader

original_load_config = ConfigReloader._load_config

def my_load_config(self):
    config = original_load_config(self)
    # Transform config
    for name, server in config.servers.items():
        server.notes = f"[Modified] {server.notes or ''}"
    return config

ConfigReloader._load_config = my_load_config
```

### 4. Message Routing Interception

```python
from magg.messaging import MessageRouter

original_route = MessageRouter.route_message

async def my_route(self, message, server_id=None):
    # Log all messages
    print(f"Routing message from {server_id}: {type(message)}")
    return await original_route(self, message, server_id)

MessageRouter.route_message = my_route
```

---

## Environment Variables

| Variable | Effect |
|----------|--------|
| `MAGG_AUTO_RELOAD` | Enable/disable file watching |
| `MAGG_RELOAD_POLL_INTERVAL` | Polling interval (seconds) |
| `MAGG_READ_ONLY` | Prevent config modifications |
| `MAGG_STDERR_SHOW` | Show subprocess stderr |
| `MAGG_SELF_PREFIX` | Prefix for magg tools (default: `magg`) |
| `MAGG_PREFIX_SEP` | Tool name separator (default: `_`) |
| `MAGG_LOG_LEVEL` | Logging verbosity |
| `MAGG_CONFIG_PATH` | Explicit config file path |
| `MAGG_PATH` | Colon-separated config search paths |
| `MAGG_PRIVATE_KEY` | RSA private key (PEM) for auth |
| `MAGG_ISSUER` | JWT token issuer |
| `MAGG_AUDIENCE` | JWT token audience |

---

## Extension Locations Summary

| Extension | File/Location |
|-----------|---------------|
| Message handlers | `magg/messaging.py` |
| Proxy behavior | `magg/proxy/mixin.py`, `magg/proxy/server.py` |
| Config reload | `magg/reload.py` |
| Server management | `magg/server/manager.py` |
| Transport | `magg/util/transport.py` |
| Authentication | `magg/auth.py` |
| Settings/Config | `magg/settings.py` |

---

## Extension Patterns

### Pattern 1: Wrapper Function

```python
def with_logging(func):
    async def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        result = await func(*args, **kwargs)
        print(f"Finished {func.__name__}")
        return result
    return wrapper

ProxyFastMCP._proxy_tool = with_logging(ProxyFastMCP._proxy_tool)
```

### Pattern 2: Subclass + Factory

```python
class MyMaggServer(MaggServer):
    # Custom behavior
    pass

def create_server(config_path):
    return MyMaggServer(config_path)
```

### Pattern 3: Composition

```python
class MaggWithMetrics:
    def __init__(self, magg_server):
        self._server = magg_server
        self._metrics = Metrics()

    async def reload_config(self):
        with self._metrics.timer("reload"):
            return await self._server.reload_config()
```

---

## Caveats

1. **No Plugin API**: Must use monkey-patching or subclassing
2. **No Middleware Chain**: Handlers execute in parallel, not sequentially
3. **Internal Reliance**: Some extensions depend on FastMCP internals
4. **Breaking Changes**: No stability guarantees for internal APIs
5. **Testing Difficulty**: Monkey-patches can make testing complex
