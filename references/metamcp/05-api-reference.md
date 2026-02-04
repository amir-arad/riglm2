# API Reference

[← Back to Index](index.md)

---

## tRPC Routers

Backend exposes tRPC procedures under `/trpc/frontend/*`.

### `mcpServers` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | Query | List all MCP servers |
| `get` | Query | Get server by UUID |
| `create` | Mutation | Create new server |
| `update` | Mutation | Update server config |
| `delete` | Mutation | Delete server |
| `refreshTools` | Mutation | Re-discover tools |

### `namespaces` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | Query | List all namespaces |
| `get` | Query | Get namespace by UUID |
| `create` | Mutation | Create namespace |
| `update` | Mutation | Update namespace |
| `delete` | Mutation | Delete namespace |
| `addServer` | Mutation | Add server to namespace |
| `removeServer` | Mutation | Remove server |
| `setServerStatus` | Mutation | Enable/disable server |

### `endpoints` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | Query | List all endpoints |
| `get` | Query | Get endpoint by UUID |
| `create` | Mutation | Create endpoint |
| `update` | Mutation | Update endpoint |
| `delete` | Mutation | Delete endpoint |

### `tools` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `listByNamespace` | Query | List tools in namespace |
| `setStatus` | Mutation | Enable/disable tool |
| `setOverrides` | Mutation | Set name/description overrides |
| `setAnnotations` | Mutation | Set custom annotations |

### `apiKeys` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | Query | List API keys |
| `create` | Mutation | Generate new key |
| `revoke` | Mutation | Deactivate key |
| `delete` | Mutation | Delete key |

### `config` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `get` | Query | Get config value |
| `set` | Mutation | Set config value |
| `getSessionLifetime` | Query | Get session timeout |

---

## REST Endpoints

### Health Check

```http
GET /health

Response: { "status": "ok" }
```

### Session Health (Streamable HTTP)

```http
GET /metamcp/{endpoint}/mcp/health/sessions

Response:
{
  "timestamp": "ISO8601",
  "streamableHttpSessions": {
    "count": N,
    "sessionIds": [...]
  },
  "metaMcpPoolStatus": {
    "idle": N,
    "active": N,
    "activeSessionIds": [...],
    "idleServerUuids": [...]
  },
  "totalActiveSessions": N
}
```

---

## MCP Endpoint Methods

### SSE Endpoint

```http
GET /metamcp/{endpoint_name}/sse
```

Long-lived Server-Sent Events connection.

### Streamable HTTP Endpoint

```http
POST /metamcp/{endpoint_name}/mcp
Headers:
  Authorization: Bearer sk_mt_xxx
  mcp-session-id: {session-id}  (optional, for existing session)

Response: MCP protocol messages
```

```http
GET /metamcp/{endpoint_name}/mcp
Headers:
  mcp-session-id: {session-id}

Long-poll for server messages
```

```http
DELETE /metamcp/{endpoint_name}/mcp
Headers:
  mcp-session-id: {session-id}

Cleanup session
```

### OpenAPI Endpoints

```http
GET /metamcp/{endpoint_name}/api/openapi.json
GET /metamcp/{endpoint_name}/api/openapi-schema.json
```

---

## OAuth Endpoints

```http
GET /.well-known/oauth-authorization-server
GET /oauth/authorize
POST /oauth/token
POST /oauth/register
```
