# Integration Patterns

[← Back to Index](index.md)

---

## Cursor IDE

```json
// .cursor/mcp.json
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

**SSE Alternative:**
```json
{
  "mcpServers": {
    "MetaMCP": {
      "url": "http://localhost:12008/metamcp/my-endpoint/sse"
    }
  }
}
```

---

## Claude Desktop (via mcp-proxy)

Claude Desktop only supports stdio servers, requiring `mcp-proxy` bridge.

### Streamable HTTP (Recommended)

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "MetaMCP": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "--transport", "streamablehttp",
        "http://localhost:12008/metamcp/my-endpoint/mcp"
      ],
      "env": {
        "API_ACCESS_TOKEN": "sk_mt_xxx"
      }
    }
  }
}
```

### SSE Alternative

```json
{
  "mcpServers": {
    "MetaMCP": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "http://localhost:12008/metamcp/my-endpoint/sse"
      ],
      "env": {
        "API_ACCESS_TOKEN": "sk_mt_xxx"
      }
    }
  }
}
```

### Config File Locations

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

---

## Open WebUI

1. Create OpenAPI endpoint in MetaMCP
2. Generate API key
3. Configure Open WebUI:
   - URL: `http://metamcp:12008/metamcp/{endpoint}/api/openapi.json`
   - Auth: Bearer token with API key

**Note:** Set `APP_URL` correctly for CORS.

---

## Custom Agent (TypeScript)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:12008/metamcp/my-endpoint/mcp"),
  {
    requestInit: {
      headers: {
        "Authorization": "Bearer sk_mt_xxx"
      }
    }
  }
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

// List tools
const tools = await client.listTools();
console.log(tools);

// Call tool
const result = await client.callTool({
  name: "filesystem__read_file",
  arguments: { path: "/tmp/test.txt" }
});
console.log(result);

// Cleanup
await client.close();
```

---

## Custom Agent (Python)

```python
from mcp import Client
from mcp.client.streamable_http import StreamableHTTPTransport

transport = StreamableHTTPTransport(
    url="http://localhost:12008/metamcp/my-endpoint/mcp",
    headers={"Authorization": "Bearer sk_mt_xxx"}
)

async with Client(transport) as client:
    # List tools
    tools = await client.list_tools()

    # Call tool
    result = await client.call_tool(
        "filesystem__read_file",
        {"path": "/tmp/test.txt"}
    )
```

---

## Multiple Endpoints

```json
{
  "mcpServers": {
    "MetaMCP-Dev": {
      "url": "http://localhost:12008/metamcp/dev-tools/mcp",
      "headers": {
        "Authorization": "Bearer sk_mt_dev_key"
      }
    },
    "MetaMCP-Prod": {
      "url": "https://metamcp.example.com/metamcp/prod-tools/mcp",
      "headers": {
        "Authorization": "Bearer sk_mt_prod_key"
      }
    }
  }
}
```

---

## No Authentication (Public Endpoint)

If endpoint has `enable_api_key_auth: false`:

```json
{
  "mcpServers": {
    "MetaMCP": {
      "url": "http://localhost:12008/metamcp/public-endpoint/mcp"
    }
  }
}
```
