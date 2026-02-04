# Core Concepts

[← Back to Index](index.md)

---

## Servers

### ServerConfig

Each MCP server is defined by a `ServerConfig`:

```python
class ServerConfig(BaseSettings):
    name: str           # Unique server name
    source: str         # URL/URI/path of the server
    prefix: str | None  # Tool prefix (e.g., "calc" → "calc_add")
    command: str | None # Main command (python, node, uvx, npx)
    args: list[str]     # Command arguments
    uri: str | None     # URI for HTTP/SSE servers
    env: dict[str, str] # Environment variables
    cwd: Path | None    # Working directory
    transport: dict     # Transport-specific config
    enabled: bool       # Whether server is enabled (default: True)
    kits: list[str]     # Kits this server belongs to
    notes: str | None   # Setup notes
```

### Transport Types

| Command | Transport |
|---------|-----------|
| `python` | NoValidatePythonStdioTransport |
| `node` | NoValidateNodeStdioTransport |
| `npx` | NpxStdioTransport |
| `uvx` | UvxStdioTransport |
| `fastmcp` | FastMCPStdioTransport |
| (other) | Generic StdioTransport |

| URI Pattern | Transport |
|-------------|-----------|
| `**/sse` or `**/sse/` | SSETransport |
| `http://` or `https://` | StreamableHttpTransport |

---

## Proxy Tool

The unified `proxy` tool provides access to all MCP capabilities:

### Actions

| Action | Description |
|--------|-------------|
| `list` | List all capabilities of a type |
| `info` | Get details about a specific capability |
| `call` | Execute a tool, read a resource, or get a prompt |

### Types

| Type | Description |
|------|-------------|
| `tool` | MCP tools |
| `resource` | MCP resources |
| `prompt` | MCP prompts |

### Parameters

```python
proxy(
    action: "list" | "info" | "call",
    type: "tool" | "resource" | "prompt",
    path: str | None,      # Name/URI (required for info/call)
    args: dict | None,     # Arguments (for call only)
    limit: int | None,     # Pagination limit (list only)
    offset: int | None,    # Pagination offset (list only)
    filter_server: str | None  # Filter by prefix (list only)
)
```

### Examples

```python
# List all tools
proxy(action="list", type="tool")

# Get tool info
proxy(action="info", type="tool", path="calc_add")

# Call a tool
proxy(action="call", type="tool", path="calc_add", args={"a": 5, "b": 3})

# Read a resource
proxy(action="call", type="resource", path="file:///etc/hosts")
```

---

## Prefixes

Tools are namespaced with prefixes to avoid conflicts:

```
{prefix}_{toolName}

Examples:
  calc_add        (prefix: calc, tool: add)
  playwright_browser_navigate
  fs_read_file
```

### Prefix Rules

- Must be a valid Python identifier
- Cannot contain underscores
- Separator is `_` by default (`MAGG_PREFIX_SEP`)
- Self-prefix for Magg tools: `magg` (`MAGG_SELF_PREFIX`)

---

## Kits

Kits bundle related servers for easy management:

### Kit File Format

```json
{
  "name": "web-tools",
  "description": "Web automation and browsing tools",
  "author": "Magg Team",
  "version": "1.0.0",
  "keywords": ["web", "browser", "automation"],
  "servers": {
    "playwright": {
      "source": "https://github.com/microsoft/playwright-mcp",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "prefix": "pw",
      "notes": "Browser automation"
    },
    "fetch": {
      "source": "https://github.com/example/fetch-mcp",
      "command": "npx",
      "args": ["-y", "@example/fetch-mcp"],
      "prefix": "fetch"
    }
  }
}
```

### Kit Locations

1. `$MAGG_KITD_PATH` (env var)
2. `~/.magg/kit.d/`
3. Project `.magg/kit.d/`

### Kit Operations

```python
# Load a kit
magg_load_kit(name="web-tools")

# Unload a kit (removes servers from config)
magg_unload_kit(name="web-tools")

# List all kits
magg_list_kits()

# Get kit details
magg_kit_info(name="web-tools")
```

---

## Mounting

### Mount Process

```python
async def mount_server(server: ServerConfig) -> bool:
    # 1. Create message handler
    message_handler = BackendMessageHandler(
        server_id=server.name,
        coordinator=self.mcp.message_coordinator
    )

    # 2. Create transport
    transport = get_transport_for_command(...)  # or get_transport_for_uri

    # 3. Create client
    client = Client(transport, message_handler=message_handler)

    # 4. Create proxy
    proxy_server = FastMCP.as_proxy(client, name=server.name)

    # 5. Mount to ProxyFastMCP
    self.mcp.mount(server=proxy_server, prefix=server.prefix)

    # 6. Track
    self.mounted_servers[server.name] = MountedServer(proxy, client)
```

### Unmount Process

```python
async def unmount_server(name: str) -> bool:
    # 1. Remove from FastMCP managers (workaround - no official unmount)
    self._unmount_from_fastmcp(name)

    # 2. Close client connection
    await server_info.client.close()

    # 3. Remove from tracking
    del self.mounted_servers[name]
```

---

## Server States

```
┌─────────────┐     enable      ┌─────────────┐
│  Disabled   │ ───────────────► │  Enabled    │
│ (in config) │ ◄─────────────── │ (in config) │
└─────────────┘     disable      └──────┬──────┘
                                        │
                                        │ mount
                                        ▼
                                 ┌─────────────┐
                                 │  Mounted    │
                                 │ (running)   │
                                 └──────┬──────┘
                                        │
                                        │ unmount
                                        ▼
                                 ┌─────────────┐
                                 │  Unmounted  │
                                 │ (enabled    │
                                 │  but not    │
                                 │  running)   │
                                 └─────────────┘
```

---

## Config Structure

### `~/.magg/config.json`

```json
{
  "servers": {
    "calculator": {
      "source": "https://github.com/modelcontextprotocol/servers",
      "prefix": "calc",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-calculator"],
      "enabled": true
    },
    "playwright": {
      "source": "https://github.com/microsoft/playwright-mcp",
      "prefix": "pw",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "enabled": true
    }
  },
  "kits": {
    "web-tools": {
      "name": "web-tools",
      "path": "/home/user/.magg/kit.d/web-tools.json"
    }
  }
}
```
