# Database Schema

[← Back to Index](index.md)

MetaMCP uses PostgreSQL with Drizzle ORM.

---

## Core Tables

### `mcp_servers`

Stores MCP server configurations.

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `name` | TEXT | Unique name (alphanumeric, `_`, `-`) |
| `description` | TEXT | Optional description |
| `type` | ENUM | `STDIO`, `SSE`, `STREAMABLE_HTTP` |
| `command` | TEXT | Command for STDIO servers |
| `args` | TEXT[] | Arguments array |
| `env` | JSONB | Environment variables |
| `url` | TEXT | URL for SSE/Streamable HTTP |
| `bearer_token` | TEXT | Auth token for remote servers |
| `headers` | JSONB | Custom headers |
| `error_status` | ENUM | `NONE`, `ERROR`, `CRASHED` |
| `user_id` | TEXT | Owner (NULL = public) |
| `created_at` | TIMESTAMP | Creation timestamp |

**Constraints:**
- Name regex: `^[a-zA-Z0-9_-]+$`
- SSE/STREAMABLE_HTTP require valid URL
- STDIO requires command

---

### `namespaces`

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `name` | TEXT | Unique name per user |
| `description` | TEXT | Optional description |
| `user_id` | TEXT | Owner (NULL = public) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update |

---

### `endpoints`

Public routing endpoints.

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `name` | TEXT | Globally unique URL-safe name |
| `description` | TEXT | Optional description |
| `namespace_uuid` | UUID | Associated namespace |
| `enable_api_key_auth` | BOOLEAN | Require API key (default: true) |
| `enable_oauth` | BOOLEAN | Enable OAuth (default: false) |
| `use_query_param_auth` | BOOLEAN | Allow `?api_key=` param |
| `user_id` | TEXT | Owner (NULL = public) |

---

### `tools`

Discovered tools from MCP servers.

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `name` | TEXT | Tool name |
| `description` | TEXT | Tool description |
| `tool_schema` | JSONB | JSON Schema for input |
| `mcp_server_uuid` | UUID | Parent MCP server |

---

### `namespace_server_mappings`

Many-to-many: Namespaces ↔ MCP Servers

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `namespace_uuid` | UUID | Namespace reference |
| `mcp_server_uuid` | UUID | Server reference |
| `status` | ENUM | `ACTIVE`, `INACTIVE` |

---

### `namespace_tool_mappings`

Tool status and overrides per namespace.

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `namespace_uuid` | UUID | Namespace reference |
| `tool_uuid` | UUID | Tool reference |
| `mcp_server_uuid` | UUID | Server reference |
| `status` | ENUM | `ACTIVE`, `INACTIVE` |
| `override_name` | TEXT | Custom tool name |
| `override_title` | TEXT | Custom tool title |
| `override_description` | TEXT | Custom description |
| `override_annotations` | JSONB | Custom MCP annotations |

---

### `api_keys`

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Primary key |
| `name` | TEXT | Key name |
| `key` | TEXT | Unique key value (`sk_mt_...`) |
| `user_id` | TEXT | Owner (NULL = public) |
| `is_active` | BOOLEAN | Active status |

---

## Authentication Tables (Better Auth)

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `sessions` | Active sessions |
| `accounts` | OAuth provider accounts |
| `verifications` | Email/password verification tokens |

---

## OAuth Tables (MCP OAuth)

| Table | Description |
|-------|-------------|
| `oauth_clients` | Registered OAuth clients |
| `oauth_authorization_codes` | Authorization codes |
| `oauth_access_tokens` | Access tokens |
| `oauth_sessions` | MCP server OAuth sessions |

---

## Configuration Table

| Table | Description |
|-------|-------------|
| `config` | App-wide settings (session lifetime, registration controls) |

---

## Connection String

```
postgresql://metamcp_user:m3t4mcp@localhost:9433/metamcp_db
```
