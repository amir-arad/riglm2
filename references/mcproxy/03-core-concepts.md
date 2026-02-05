# Core Concepts

[← Back to Index](index.md)

---

## Tool Name Prefixing

MCProxy prefixes all tool, prompt, and resource names with their server name to avoid conflicts.

### Format

```
{server_name}___{item_name}

Examples:
- github___create_issue
- file_server___read_file
- web___fetch_url
```

**Separator**: Three underscores (`___`)

### Why Three Underscores?

- Single underscore (`_`) is common in tool names
- Double underscore (`__`) appears in some naming conventions
- Triple underscore (`___`) is highly unlikely in existing names

### Extraction Logic

```rust
fn extract_server_and_name(prefixed: &str) -> Result<(&str, &str)> {
    prefixed.find("___")
        .map(|pos| (&prefixed[..pos], &prefixed[pos + 3..]))
        .ok_or_else(|| ProxyError::InvalidFormat("No server prefix".into()))
}
```

---

## Server Types

MCProxy supports two server connection types:

### STDIO Servers

Spawn subprocess with command and arguments:

```json
{
  "file-server": {
    "command": "npx",
    "args": ["@modelcontextprotocol/server-filesystem", "/tmp"],
    "env": {
      "DEBUG": "true"
    }
  }
}
```

- Process managed by MCProxy
- Graceful shutdown with SIGTERM/SIGKILL
- Environment variables passed to process

### HTTP Servers

Connect to remote HTTP endpoint:

```json
{
  "github": {
    "url": "https://api.github.com/mcp",
    "authorizationToken": "Bearer ghp_xxx"
  }
}
```

- Bearer token authentication
- No process management
- Connection maintained for session duration

---

## Tool Routing

When a client calls a tool:

1. **Parse Prefixed Name**: Extract server name and actual tool name
2. **Lookup Server**: Find server in connection map
3. **Apply Middleware**: Run ClientMiddleware chain
4. **Execute Call**: Send to upstream server
5. **Return Result**: Pass response back through middleware

### Special Case: search_available_tools

The `search_available_tools` tool (injected by ToolSearchMiddleware):
- Has no prefix
- Handled internally by `handle_search_tool_call()`
- Searches Tantivy index
- Returns matching tools with updated exposure

---

## Request ID Correlation

All middleware hooks receive a `request_id: Uuid` for correlation:

```rust
async fn before_call_tool(
    &self,
    request_id: Uuid,
    request: &CallToolRequestParam
) -> MiddlewareResult
```

**Use cases:**
- Log correlation across middleware chain
- Timing measurements
- Request tracing

---

## Graceful Shutdown

MCProxy implements careful shutdown for STDIO servers:

```
1. Receive shutdown signal (Ctrl+C)
2. Clear all server connections
3. For each STDIO server:
   a. Send SIGTERM to process group
   b. Wait configurable timeout (default: 5s)
   c. If still running, send SIGKILL
4. Close all connections
5. Exit cleanly
```

### Timeout Configuration

```json
{
  "httpServer": {
    "shutdownTimeout": 5
  }
}
```

---

## JSON-RPC 2.0 Protocol

MCProxy speaks standard JSON-RPC 2.0 over HTTP:

### Supported Methods

| Method | Description |
|--------|-------------|
| `ping` | Connectivity check |
| `initialize` | Get server capabilities |
| `tools/list` | List all aggregated tools |
| `tools/call` | Execute tool on server |
| `prompts/list` | List all prompts |
| `resources/list` | List all resources |

### Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32602 | Invalid params |
| -32603 | Internal error |

### Example Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "github___create_issue",
    "arguments": {
      "title": "Bug report",
      "body": "Description here"
    }
  }
}
```

---

## SSE Streaming

Some operations return Server-Sent Events:

```
1. First event: Notification (notifications/tools/list_changed)
2. Second event: Tool result
3. Stream closes
```

**Triggered by:**
- `search_available_tools` calls
- Tools explicitly supporting streaming

---

## Resource Aggregation

Like tools, prompts and resources are aggregated:

```rust
pub async fn get_all_prompts(&self) -> Vec<Prompt> {
    let servers = self.servers.read().await;
    servers.values()
        .flat_map(|s| s.prompts.iter())
        .cloned()
        .collect()
}
```

Resources follow the same prefixing scheme:
- `server___resource_name`
