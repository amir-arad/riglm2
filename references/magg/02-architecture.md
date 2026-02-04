# Magg Architecture

[← Back to Index](index.md)

---

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP Clients                                  │
│              (Claude Desktop, Cursor, Custom Agents)                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌─────────┐    ┌──────────┐    ┌──────────┐
              │  STDIO  │    │   HTTP   │    │  Hybrid  │
              │  Mode   │    │   Mode   │    │   Mode   │
              └─────────┘    └──────────┘    └──────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MaggRunner                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Signal    │  │   Reload    │  │  Shutdown   │                  │
│  │  Handlers   │  │   Events    │  │   Events    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MaggServer                                   │
│  ┌─────────────────────────────────────────────────┐                │
│  │              ServerManager                       │                │
│  │  ┌─────────────┐  ┌─────────────┐               │                │
│  │  │ ConfigMgr   │  │ KitManager  │               │                │
│  │  │ (reload)    │  │ (bundles)   │               │                │
│  │  └─────────────┘  └─────────────┘               │                │
│  │  ┌─────────────────────────────────────────────┐│                │
│  │  │           ProxyFastMCP                      ││                │
│  │  │  ┌──────────────┐ ┌──────────────┐         ││                │
│  │  │  │ MessageRouter│ │ Coordinator  │         ││                │
│  │  │  └──────────────┘ └──────────────┘         ││                │
│  │  └─────────────────────────────────────────────┘│                │
│  │  ┌─────────────────────────────────────────────┐│                │
│  │  │        mounted_servers: Dict                 ││                │
│  │  │  ┌────────────┐ ┌────────────┐             ││                │
│  │  │  │ MountedSrv │ │ MountedSrv │ ...         ││                │
│  │  │  │ (proxy,    │ │ (proxy,    │             ││                │
│  │  │  │  client)   │ │  client)   │             ││                │
│  │  │  └────────────┘ └────────────┘             ││                │
│  │  └─────────────────────────────────────────────┘│                │
│  └─────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌─────────┐    ┌──────────┐    ┌──────────┐
              │  STDIO  │    │   SSE    │    │Streamable│
              │ Servers │    │ Servers  │    │   HTTP   │
              └─────────┘    └──────────┘    └──────────┘
```

---

## Class Hierarchy

```python
MaggRunner
  └── MaggServer (extends ManagedServer)
        ├── ServerManager
        │   ├── ConfigManager
        │   │   └── ReloadManager
        │   │       └── ConfigReloader
        │   │           └── WatchdogHandler
        │   ├── ProxyFastMCP (extends ProxyMCP, FastMCP)
        │   │   ├── MessageRouter
        │   │   └── ServerMessageCoordinator
        │   └── mounted_servers: Dict[str, MountedServer]
        │       └── MountedServer
        │           ├── proxy: FastMCP
        │           └── client: Client
        └── KitManager
```

---

## Key Files

| File | Purpose |
|------|---------|
| `magg/cli.py` | CLI entry point, argument parsing |
| `magg/server/runner.py` | MaggRunner - signal handling, lifecycle |
| `magg/server/server.py` | MaggServer - tools/resources/prompts registration |
| `magg/server/manager.py` | ServerManager - mount/unmount, reload handling |
| `magg/proxy/server.py` | ProxyFastMCP, BackendMessageHandler |
| `magg/proxy/mixin.py` | ProxyMCP - the unified proxy tool |
| `magg/reload.py` | ConfigReloader, WatchdogHandler, file watching |
| `magg/messaging.py` | MessageRouter, ServerMessageCoordinator |
| `magg/settings.py` | ConfigManager, ServerConfig, MaggConfig |
| `magg/kit.py` | KitManager - server bundles |
| `magg/auth.py` | BearerAuthManager - JWT authentication |
| `magg/util/transport.py` | Transport selection (stdio, SSE, HTTP) |

---

## Data Flow

### Request Flow

```
Client Request
    │
    ▼
ProxyFastMCP._proxy_tool(action, type, path, args)
    │
    ├── action="list" → _proxy_list(type) → list all capabilities
    ├── action="info" → _proxy_info(type, name) → get details
    └── action="call" → _proxy_call(type, path, args) → execute
              │
              ▼
        Client(transport) → Backend MCP Server → Response
              │
              ▼
        Annotate with proxy metadata
              │
              ▼
        Return to client
```

### Notification Flow

```
Backend MCP Server
    │
    ▼ (ToolListChangedNotification)
BackendMessageHandler.on_tool_list_changed()
    │
    ▼
ServerMessageCoordinator.handle_tool_list_changed()
    │
    ▼
MessageRouter.route_message()
    │
    ▼ (asyncio.gather)
[Handler1, Handler2, ...] (global + server-specific)
    │
    ▼
MaggMessageHandler.on_tool_list_changed()
    │
    ▼
User callback (if registered)
```

---

## Key Components

### MaggRunner (`magg/server/runner.py`)
- Signal handling (SIGINT, SIGTERM, SIGHUP)
- Lifecycle management (start, stop, reload)
- Context manager for server lifecycle

### ServerManager (`magg/server/manager.py`)
- Mount/unmount MCP servers
- Handle config reload (ordered phases)
- Track mounted servers

### ProxyFastMCP (`magg/proxy/server.py`)
- Extends FastMCP with proxy capabilities
- Message routing infrastructure
- Backend client creation via FastMCPTransport

### ConfigReloader (`magg/reload.py`)
- File watching (watchdog/polling)
- Change detection
- Validation before apply

### MessageRouter (`magg/messaging.py`)
- Register global/per-server handlers
- Route notifications to handlers
- Async dispatch with error handling
