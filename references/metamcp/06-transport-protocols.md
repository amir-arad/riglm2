# Transport Protocols

[← Back to Index](index.md)

---

## SSE (Server-Sent Events)

**Endpoint:** `/metamcp/{endpoint_name}/sse`

### Characteristics
- Long-lived HTTP connection
- Server pushes events to client
- Backward compatible with older MCP clients
- Requires proper proxy configuration (no buffering)

### Client Configuration

```json
{
  "mcpServers": {
    "MetaMCP": {
      "url": "http://localhost:12008/metamcp/my-endpoint/sse"
    }
  }
}
```

### Proxy Requirements
- Disable buffering
- Long read/send timeouts (86400s recommended)
- HTTP/1.1 with empty Connection header

---

## Streamable HTTP

**Endpoint:** `/metamcp/{endpoint_name}/mcp`

### Characteristics
- Modern MCP transport protocol
- Supports bidirectional streaming
- Session-based with `mcp-session-id` header
- Recommended for new integrations

### HTTP Methods

| Method | Purpose |
|--------|---------|
| `POST /mcp` | Initialize session or send messages |
| `GET /mcp` | Long-poll for server messages |
| `DELETE /mcp` | Clean up session |

### Client Configuration

```json
{
  "mcpServers": {
    "MetaMCP": {
      "url": "http://localhost:12008/metamcp/my-endpoint/mcp",
      "headers": {
        "Authorization": "Bearer sk_mt_xxx"
      }
    }
  }
}
```

### Session Flow

1. Client sends `POST /mcp` without session ID
2. Server creates session, returns `mcp-session-id`
3. Client includes session ID in subsequent requests
4. Client sends `DELETE /mcp` to cleanup

---

## OpenAPI

**Endpoints:**
- `/metamcp/{endpoint_name}/api/openapi.json` - Full OpenAPI spec
- `/metamcp/{endpoint_name}/api/openapi-schema.json` - Schema only

### Use Case
Integration with tools like Open WebUI that consume OpenAPI specifications.

### Configuration for Open WebUI

1. Create OpenAPI endpoint in MetaMCP
2. Configure URL: `http://metamcp:12008/metamcp/{endpoint}/api/openapi.json`
3. Set Auth: Bearer token with API key

---

## Transport Comparison

| Feature | SSE | Streamable HTTP | OpenAPI |
|---------|-----|-----------------|---------|
| Bidirectional | No | Yes | No |
| Session-based | No | Yes | No |
| Compatibility | High | Modern | REST tools |
| Recommended | Legacy | New projects | REST integration |
