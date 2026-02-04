# Core Concepts

[← Back to Index](index.md)

---

## MCP Server

An MCP server configuration that tells MetaMCP how to spawn and connect to an MCP server.

### Server Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `STDIO` | Local process via command execution | `command`, `args` |
| `SSE` | Server-Sent Events remote server | `url` |
| `STREAMABLE_HTTP` | HTTP streaming remote server | `url` |

### Example Configurations

```json
// STDIO Server
{
  "name": "filesystem",
  "type": "STDIO",
  "command": "uvx",
  "args": ["mcp-server-filesystem", "/tmp"],
  "env": {
    "DEBUG": "true"
  }
}

// SSE Server
{
  "type": "SSE",
  "url": "https://api.example.com/sse",
  "bearerToken": "your-bearer-token",
  "headers": {
    "X-Custom-Header": "value"
  }
}

// Streamable HTTP Server
{
  "type": "STREAMABLE_HTTP",
  "url": "https://api.example.com/mcp",
  "bearerToken": "your-bearer-token"
}
```

### Environment Variable Interpolation

Reference container environment variables in server configs:

```json
{
  "env": {
    "API_KEY": "${API_KEY}",
    "SECRET": "${MY_SECRET}"
  }
}
```

- `${VAR_NAME}` resolved at runtime from container environment
- Missing variables log warning but don't crash
- Secrets auto-redacted in logs

---

## Namespace

A logical grouping of MCP servers that exposes a unified interface.

### Features
- Group multiple MCP servers
- Enable/disable servers at namespace level
- Enable/disable individual tools
- Override tool names, titles, descriptions
- Add custom MCP annotations
- Apply middleware

### Tool Naming Convention

```
{ServerName}__{originalToolName}
```

**Examples:**
- `filesystem__read_file`
- `git-helper__git_status`
- `database__query`

---

## Endpoint

A public interface exposing a namespace as an accessible MCP server.

### URL Patterns

| Transport | URL Pattern |
|-----------|-------------|
| SSE | `/metamcp/{endpoint_name}/sse` |
| Streamable HTTP | `/metamcp/{endpoint_name}/mcp` |
| OpenAPI | `/metamcp/{endpoint_name}/api/openapi.json` |
| OpenAPI Schema | `/metamcp/{endpoint_name}/api/openapi-schema.json` |

### Endpoint Settings
- `enable_api_key_auth` - Require API key (default: true)
- `enable_oauth` - Enable OAuth authentication
- `use_query_param_auth` - Allow `?api_key=` parameter

---

## Middleware

Intercepts and transforms MCP requests/responses at namespace level.

### Pipeline Flow

```
Request → [Middleware 1] → [Middleware 2] → ... → MCP Server
                                                      ↓
Response ← [Middleware N] ← ... ← [Middleware 1] ← Response
```

### Built-in Middleware

| Middleware | Status | Description |
|------------|--------|-------------|
| Filter inactive tools | Available | Remove disabled tools |
| Request logging | Planned | Log all MCP requests |
| Rate limiting | Planned | Throttle requests |
| Input validation | Planned | Validate tool inputs |
| Response caching | Planned | Cache responses |

---

## Tool Overrides

Override tool metadata per namespace without modifying source servers.

### Available Overrides

```json
{
  "override_name": "custom_tool_name",
  "override_title": "Human Readable Title",
  "override_description": "Custom description for this namespace",
  "override_annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "customField": "value"
  }
}
```

Annotations are merged with upstream server metadata.
