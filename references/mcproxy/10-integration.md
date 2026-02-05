# Client Integration

[← Back to Index](index.md)

---

## Starting MCProxy

### Command Line

```bash
# Basic start
mcproxy -c config.json

# With verbose logging
RUST_LOG=debug mcproxy -c config.json

# Override port
MCPROXY_HTTP_PORT=9000 mcproxy -c config.json
```

### Docker

```dockerfile
FROM rust:1.75-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/mcproxy /usr/local/bin/
COPY config.json /etc/mcproxy/
CMD ["mcproxy", "-c", "/etc/mcproxy/config.json"]
```

```bash
docker run -p 8080:8080 -v $(pwd)/config.json:/etc/mcproxy/config.json mcproxy
```

---

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mcproxy": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", "@-",
        "http://localhost:8080/mcp"
      ]
    }
  }
}
```

Or if MCProxy is running with stdio transport:

```json
{
  "mcpServers": {
    "mcproxy": {
      "command": "/path/to/mcproxy",
      "args": ["-c", "/path/to/config.json", "--stdio"]
    }
  }
}
```

---

## Cursor Configuration

In Cursor settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mcproxy": {
      "transport": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

---

## Custom Agent Integration

### Python (using requests)

```python
import requests
import json

class MCProxyClient:
    def __init__(self, url="http://localhost:8080/mcp"):
        self.url = url
        self.request_id = 0

    def _call(self, method, params=None):
        self.request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {}
        }
        response = requests.post(self.url, json=payload)
        return response.json()

    def list_tools(self):
        result = self._call("tools/list")
        return result.get("result", {}).get("tools", [])

    def call_tool(self, name, arguments):
        result = self._call("tools/call", {
            "name": name,
            "arguments": arguments
        })
        return result.get("result", {})

    def search_tools(self, query):
        return self.call_tool("search_available_tools", {"query": query})


# Usage
client = MCProxyClient()

# List available tools
tools = client.list_tools()
for tool in tools[:5]:
    print(f"{tool['name']}: {tool.get('description', '')[:50]}")

# Search for tools
results = client.search_tools("github issue")
print(results)

# Call a specific tool
result = client.call_tool("github___list_issues", {
    "repo": "owner/repo",
    "state": "open"
})
```

### TypeScript/Node.js

```typescript
import fetch from 'node-fetch';

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

class MCProxyClient {
  private url: string;
  private requestId = 0;

  constructor(url = 'http://localhost:8080/mcp') {
    this.url = url;
  }

  private async call(method: string, params?: Record<string, any>): Promise<any> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params: params || {},
      }),
    });

    const json = (await response.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(`${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }

  async listTools(): Promise<any[]> {
    const result = await this.call('tools/list');
    return result.tools || [];
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    return this.call('tools/call', { name, arguments: args });
  }

  async searchTools(query: string): Promise<any> {
    return this.callTool('search_available_tools', { query });
  }
}

// Usage
const client = new MCProxyClient();

const tools = await client.listTools();
console.log(`Found ${tools.length} tools`);

const searchResults = await client.searchTools('file read');
console.log(searchResults);
```

---

## Health Checking

```bash
# Simple health check
curl http://localhost:8080/health

# Response
{"service": "mcproxy", "status": "healthy"}
```

### Health Check Script

```bash
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$response" = "200" ]; then
    echo "MCProxy is healthy"
    exit 0
else
    echo "MCProxy is unhealthy (HTTP $response)"
    exit 1
fi
```

---

## Load Balancer Configuration

### Nginx

```nginx
upstream mcproxy {
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
    keepalive 32;
}

server {
    listen 80;
    server_name mcp.example.com;

    location /mcp {
        proxy_pass http://mcproxy;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    location /health {
        proxy_pass http://mcproxy;
    }
}
```

---

## CORS Configuration

### Allow Specific Origins

```json
{
  "httpServer": {
    "corsEnabled": true,
    "corsOrigins": [
      "http://localhost:3000",
      "https://myapp.example.com"
    ]
  }
}
```

### Disable CORS (for same-origin)

```json
{
  "httpServer": {
    "corsEnabled": false
  }
}
```

---

## SSE Event Handling

When `search_available_tools` is called, MCProxy streams SSE events:

```javascript
const eventSource = new EventSource('http://localhost:8080/mcp/sse');

eventSource.addEventListener('notifications/tools/list_changed', (event) => {
  console.log('Tool list changed, refetching...');
  // Re-fetch tools/list
});

eventSource.addEventListener('result', (event) => {
  const result = JSON.parse(event.data);
  console.log('Search result:', result);
});
```

### Handling in Python

```python
import sseclient
import requests

def handle_sse():
    response = requests.get('http://localhost:8080/mcp/sse', stream=True)
    client = sseclient.SSEClient(response)

    for event in client.events():
        if event.event == 'notifications/tools/list_changed':
            print("Tool list changed")
        elif event.event == 'result':
            print(f"Result: {event.data}")
```

---

## Connection Management

### Keep-Alive

MCProxy supports HTTP keep-alive. Configure clients to reuse connections:

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retries = Retry(total=3, backoff_factor=0.1)
adapter = HTTPAdapter(
    pool_connections=10,
    pool_maxsize=10,
    max_retries=retries
)
session.mount('http://', adapter)

# Use session for all requests
response = session.post('http://localhost:8080/mcp', json=payload)
```

### Connection Timeout

```python
response = requests.post(
    'http://localhost:8080/mcp',
    json=payload,
    timeout=(5, 30)  # (connect timeout, read timeout)
)
```
