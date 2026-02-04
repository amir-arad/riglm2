# Configuration

[← Back to Index](index.md)

---

## Configuration Files

### Config File Location

Search order (first found is used):
1. `$MAGG_CONFIG_PATH` (explicit path)
2. `<project>/.magg/config.json`
3. `~/.magg/config.json`

### Config File Format

```json
{
  "servers": {
    "server-name": {
      "source": "https://github.com/example/mcp-server",
      "prefix": "prefix",
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "uri": null,
      "env": {
        "API_KEY": "secret"
      },
      "cwd": "/path/to/working/dir",
      "transport": {},
      "enabled": true,
      "notes": "Setup notes"
    }
  },
  "kits": {
    "kit-name": {
      "name": "kit-name",
      "path": "/path/to/kit.json"
    }
  }
}
```

### Server Config Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | URL/URI/path of server package |
| `prefix` | string | No | Tool name prefix |
| `command` | string | No* | Main command (python, node, npx, uvx) |
| `args` | list | No | Command arguments |
| `uri` | string | No* | URI for HTTP/SSE servers |
| `env` | dict | No | Environment variables |
| `cwd` | string | No | Working directory |
| `transport` | dict | No | Transport-specific config |
| `enabled` | bool | No | Default: true |
| `notes` | string | No | Setup notes |
| `kits` | list | No | Kits this server belongs to |

*Either `command` or `uri` is required.

---

## Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MAGG_CONFIG_PATH` | - | Explicit config file path |
| `MAGG_PATH` | See below | Colon-separated search paths |
| `MAGG_LOG_LEVEL` | `INFO` | Logging level |
| `MAGG_READ_ONLY` | `false` | Prevent config modifications |

### Hot Reload

| Variable | Default | Description |
|----------|---------|-------------|
| `MAGG_AUTO_RELOAD` | `true` | Enable file watching |
| `MAGG_RELOAD_POLL_INTERVAL` | `1.0` | Polling interval (seconds) |
| `MAGG_RELOAD_USE_WATCHDOG` | `null` | Force watchdog on/off |

### Tool Naming

| Variable | Default | Description |
|----------|---------|-------------|
| `MAGG_SELF_PREFIX` | `magg` | Prefix for Magg tools |
| `MAGG_PREFIX_SEP` | `_` | Separator between prefix and tool |

### Server Output

| Variable | Default | Description |
|----------|---------|-------------|
| `MAGG_STDERR_SHOW` | `false` | Show subprocess stderr |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `MAGG_PRIVATE_KEY` | - | RSA private key (PEM format) |
| `MAGG_ISSUER` | `https://magg.local` | JWT token issuer |
| `MAGG_AUDIENCE` | `magg` | JWT token audience |
| `MAGG_JWT` | - | JWT token for client auth |

---

## Default Search Paths

`MAGG_PATH` defaults to:
```
<project>/.magg:~/.magg:<contrib_paths>
```

Each path is searched for:
- `config.json` - Main configuration
- `kit.d/` - Kit files directory

---

## Kit Directory

### Location

1. `$MAGG_KITD_PATH` (env var)
2. `~/.magg/kit.d/`
3. `<project>/.magg/kit.d/`

### Kit File Format

```json
{
  "name": "web-tools",
  "description": "Web automation and browsing tools",
  "author": "Author Name",
  "version": "1.0.0",
  "keywords": ["web", "browser", "automation"],
  "links": {
    "homepage": "https://github.com/example/web-tools-kit",
    "docs": "https://github.com/example/web-tools-kit/wiki"
  },
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

---

## Authentication Config

### `~/.magg/auth.json`

```json
{
  "bearer": {
    "issuer": "https://magg.local",
    "audience": "magg",
    "key_path": "/home/user/.ssh/magg"
  }
}
```

### Key Files

- Private key: `<key_path>/<audience>.key`
- Public key: `<key_path>/<audience>.key.pub`

### Generate Keys

```bash
# Via CLI
magg auth keygen

# Manual
openssl genrsa -out ~/.ssh/magg/magg.key 2048
openssl rsa -in ~/.ssh/magg/magg.key -pubout -out ~/.ssh/magg/magg.key.pub
```

### Generate Token

```bash
magg auth token

# With custom parameters
magg auth token --expires 3600 --issuer custom-issuer
```

---

## Configuration Examples

### Minimal Config

```json
{
  "servers": {
    "calculator": {
      "source": "https://github.com/modelcontextprotocol/servers",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-calculator"]
    }
  }
}
```

### Full Config

```json
{
  "servers": {
    "calculator": {
      "source": "https://github.com/modelcontextprotocol/servers",
      "prefix": "calc",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-calculator"],
      "enabled": true,
      "notes": "Basic math operations"
    },
    "filesystem": {
      "source": "https://github.com/modelcontextprotocol/servers",
      "prefix": "fs",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "--", "--readonly", "/home/user"],
      "enabled": true,
      "notes": "Read-only filesystem access"
    },
    "playwright": {
      "source": "https://github.com/microsoft/playwright-mcp",
      "prefix": "pw",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "enabled": true,
      "notes": "Browser automation",
      "kits": ["web-tools"]
    },
    "disabled-server": {
      "source": "https://github.com/example/server",
      "command": "python",
      "args": ["-m", "example_server"],
      "enabled": false,
      "notes": "Currently disabled"
    },
    "http-server": {
      "source": "https://example.com/mcp",
      "prefix": "api",
      "uri": "https://example.com/mcp/sse",
      "enabled": true,
      "notes": "Remote MCP server via SSE"
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

### Config with Environment Variables

```json
{
  "servers": {
    "api-server": {
      "source": "https://github.com/example/api-mcp",
      "prefix": "api",
      "command": "python",
      "args": ["-m", "api_mcp"],
      "env": {
        "API_KEY": "${API_KEY}",
        "API_SECRET": "${API_SECRET}",
        "DEBUG": "true"
      }
    }
  }
}
```

---

## MaggConfig Python Model

```python
class MaggConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MAGG_",
        env_file=".env",
    )

    path: list[Path]          # Search paths
    config_path: Path | None  # Explicit config path
    read_only: bool           # Read-only mode
    log_level: str | None     # Logging level
    self_prefix: str          # Magg tools prefix
    prefix_sep: str           # Prefix separator
    auto_reload: bool         # Enable auto-reload
    reload_poll_interval: float  # Poll interval
    stderr_show: bool         # Show stderr
    servers: dict[str, ServerConfig]  # Server configs
    kits: dict[str, KitInfo]  # Loaded kits
```

---

## Validation Rules

### Server Prefix

- Must be a valid Python identifier
- Cannot contain underscores
- Must not conflict with other servers

### Server Config

- Must have either `command` or `uri`
- `uri` must be a valid URL

### Config File

- Must be valid JSON
- Servers dict keys are server names
