# Configuration Reference

[← Back to Index](index.md)

---

## Configuration File Location

MCProxy reads configuration from a JSON file specified via CLI:

```bash
mcproxy --config /path/to/config.json
# or
mcproxy -c config.json
```

---

## Full Configuration Schema

```json
{
  "mcpServers": {
    "<server-name>": {
      // EITHER stdio config:
      "command": "string",
      "args": ["string"],
      "env": { "KEY": "VALUE" }

      // OR http config:
      "url": "string",
      "authorizationToken": "string"
    }
  },
  "httpServer": {
    "host": "string",
    "port": "number",
    "corsEnabled": "boolean",
    "corsOrigins": ["string"],
    "shutdownTimeout": "number",
    "middleware": {
      "proxy": [
        {
          "type": "string",
          "enabled": "boolean",
          "config": {}
        }
      ],
      "client": {
        "default": [
          {
            "type": "string",
            "enabled": "boolean",
            "config": {}
          }
        ],
        "servers": {
          "<server-name>": [
            {
              "type": "string",
              "enabled": "boolean",
              "config": {}
            }
          ]
        }
      }
    }
  }
}
```

---

## Server Configuration

### STDIO Server

Spawns a subprocess:

```json
{
  "mcpServers": {
    "file-server": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-filesystem",
        "/home/user/documents"
      ],
      "env": {
        "DEBUG": "true",
        "NODE_ENV": "production"
      }
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | String | Yes | Executable to run |
| `args` | Array | No | Command arguments |
| `env` | Object | No | Environment variables |

### HTTP Server

Connects to remote endpoint:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://mcp.github.com/v1",
      "authorizationToken": "Bearer ghp_xxxxxxxxxxxx"
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | String | Yes | HTTP endpoint URL |
| `authorizationToken` | String | No | Bearer token for auth |

---

## HTTP Server Configuration

```json
{
  "httpServer": {
    "host": "127.0.0.1",
    "port": 8080,
    "corsEnabled": true,
    "corsOrigins": ["*"],
    "shutdownTimeout": 5
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | String | "localhost" | Bind address |
| `port` | Number | 8080 | Listen port |
| `corsEnabled` | Boolean | true | Enable CORS |
| `corsOrigins` | Array | ["*"] | Allowed origins |
| `shutdownTimeout` | Number | 5 | Graceful shutdown seconds |

---

## Middleware Configuration

### Proxy Middleware

Applied to aggregated results:

```json
{
  "middleware": {
    "proxy": [
      {
        "type": "description_enricher",
        "enabled": true,
        "config": {}
      },
      {
        "type": "tool_search",
        "enabled": true,
        "config": {
          "maxToolsLimit": 50,
          "searchThreshold": 0.1,
          "toolSelectionOrder": ["server_priority", "alphabetical"]
        }
      }
    ]
  }
}
```

### Client Middleware (Default)

Applied to all servers:

```json
{
  "middleware": {
    "client": {
      "default": [
        {
          "type": "logging",
          "enabled": true,
          "config": {
            "level": "info"
          }
        }
      ]
    }
  }
}
```

### Client Middleware (Per-Server)

Overrides default for specific servers:

```json
{
  "middleware": {
    "client": {
      "default": [
        { "type": "logging" }
      ],
      "servers": {
        "github": [
          { "type": "logging" },
          {
            "type": "security",
            "config": {
              "rules": [...]
            }
          }
        ],
        "internal-server": [
          // No middleware for trusted internal server
        ]
      }
    }
  }
}
```

**Important**: Per-server config **replaces** default, doesn't merge.

---

## Environment Variable Overrides

Override config values with environment variables:

| Variable | Overrides | Example |
|----------|-----------|---------|
| `MCPROXY_HTTP_HOST` | `httpServer.host` | `0.0.0.0` |
| `MCPROXY_HTTP_PORT` | `httpServer.port` | `9000` |
| `MCPROXY_CORS_ENABLED` | `httpServer.corsEnabled` | `false` |
| `MCPROXY_CORS_ORIGINS` | `httpServer.corsOrigins` | `http://localhost:3000,http://localhost:8000` |
| `MCPROXY_SHUTDOWN_TIMEOUT` | `httpServer.shutdownTimeout` | `10` |

### Environment in Server Configs

Reference container environment in server env:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://mcp.github.com/v1",
      "authorizationToken": "${GITHUB_TOKEN}"
    },
    "file-server": {
      "command": "npx",
      "args": ["server"],
      "env": {
        "API_KEY": "${API_KEY}",
        "DEBUG": "${DEBUG:-false}"
      }
    }
  }
}
```

---

## Complete Example Configuration

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/workspace"],
      "env": {}
    },
    "github": {
      "url": "https://mcp.github.com/v1",
      "authorizationToken": "Bearer ${GITHUB_TOKEN}"
    },
    "memory": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"],
      "env": {}
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "env": {}
    }
  },
  "httpServer": {
    "host": "0.0.0.0",
    "port": 8080,
    "corsEnabled": true,
    "corsOrigins": ["http://localhost:3000"],
    "shutdownTimeout": 10,
    "middleware": {
      "proxy": [
        {
          "type": "tool_search",
          "enabled": true,
          "config": {
            "maxToolsLimit": 50,
            "searchThreshold": 0.1,
            "toolSelectionOrder": ["server_priority"]
          }
        },
        {
          "type": "description_enricher",
          "enabled": false,
          "config": {}
        }
      ],
      "client": {
        "default": [
          {
            "type": "logging",
            "enabled": true,
            "config": {}
          }
        ],
        "servers": {
          "github": [
            { "type": "logging" },
            {
              "type": "tool_filter",
              "config": {
                "disallow": "delete_|remove_"
              }
            },
            {
              "type": "security",
              "config": {
                "rules": [
                  {
                    "name": "no_force_push",
                    "pattern": "force.*push|--force",
                    "block_message": "Force push operations not allowed",
                    "enabled": true
                  }
                ]
              }
            }
          ],
          "filesystem": [
            { "type": "logging" },
            {
              "type": "tool_filter",
              "config": {
                "allow": "^(read|list|search)_"
              }
            }
          ]
        }
      }
    }
  }
}
```

---

## Minimal Configuration

Simplest working config:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"]
    }
  }
}
```

All other values use defaults:
- Host: localhost
- Port: 8080
- CORS: enabled for all origins
- Middleware: none

---

## Configuration Validation

MCProxy validates config on startup. Errors include:

```
Error: Invalid configuration
  - mcpServers.github: missing required field 'url'
  - httpServer.port: must be between 1 and 65535
  - middleware.proxy[0]: unknown type 'invalid_middleware'
```

### Valid Middleware Types

**Proxy Middleware:**
- `description_enricher`
- `tool_search`

**Client Middleware:**
- `logging`
- `tool_filter`
- `security`
