# Integration

[← Back to Index](index.md)

---

## Running Modes

### STDIO Mode (Default)

Standard MCP protocol over stdin/stdout.

```bash
magg serve
```

```python
# Programmatic
runner = MaggRunner(config_path="~/.magg/config.json")
await runner.run_stdio()
```

### HTTP Mode

MCP over HTTP with SSE/Streamable HTTP.

```bash
magg serve --http --host localhost --port 8000
```

```python
runner = MaggRunner(config_path="~/.magg/config.json")
await runner.run_http(host="localhost", port=8000)
```

### Hybrid Mode

Both STDIO and HTTP simultaneously.

```bash
magg serve --hybrid --host localhost --port 8000
```

```python
runner = MaggRunner(config_path="~/.magg/config.json")
await runner.run_hybrid(host="localhost", port=8000)
```

---

## Integration Patterns

### Pattern 1: Subprocess

Run Magg as a subprocess and connect via stdio.

```python
import subprocess
from mcp import Client, StdioTransport

# Start Magg subprocess
process = subprocess.Popen(
    ["magg", "serve"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)

# Connect client
transport = StdioTransport(process.stdin, process.stdout)
client = Client(transport)

async with client:
    tools = await client.list_tools()
```

### Pattern 2: In-Process (FastMCPTransport)

Run Magg in-process for tight integration.

```python
from magg.server.server import MaggServer
from fastmcp.client import FastMCPTransport, Client

# Create server
server = MaggServer(config_path="~/.magg/config.json")

# Setup and run
async with server:
    # Create in-memory client
    transport = FastMCPTransport(server.mcp)
    client = Client(transport)

    async with client:
        tools = await client.list_tools()
        result = await client.call_tool("calc_add", {"a": 5, "b": 3})
```

### Pattern 3: MaggRunner with Client

Use MaggRunner's built-in client.

```python
from magg.server.runner import MaggRunner

runner = MaggRunner(config_path="~/.magg/config.json")

async with runner:
    # runner.client is pre-configured
    async with runner.client:
        tools = await runner.client.list_tools()
```

### Pattern 4: HTTP Client

Connect to Magg via HTTP.

```python
from mcp import Client
from mcp.transports import SSETransport, StreamableHttpTransport

# SSE transport
transport = SSETransport("http://localhost:8000/mcp/sse")

# Or Streamable HTTP
transport = StreamableHttpTransport("http://localhost:8000/mcp")

client = Client(transport)
async with client:
    tools = await client.list_tools()
```

### Pattern 5: MaggClient (Convenience)

```python
from magg.client import MaggClient

# HTTP mode
async with MaggClient("http://localhost:8000/mcp") as client:
    tools = await client.list_tools()

# With message handler
from magg.messaging import MaggMessageHandler

handler = MaggMessageHandler(
    on_tool_list_changed=lambda n: print("Tools changed!")
)

async with MaggClient("http://localhost:8000/mcp", message_handler=handler) as client:
    tools = await client.list_tools()
```

---

## Integration with Agents

### Claude Desktop

```json
{
  "mcpServers": {
    "magg": {
      "command": "magg",
      "args": ["serve"]
    }
  }
}
```

### Cursor

```json
{
  "mcp": {
    "servers": {
      "magg": {
        "command": "magg",
        "args": ["serve"]
      }
    }
  }
}
```

### Custom Agent (riglm2 Example)

```python
from magg.server.server import MaggServer
from magg.messaging import MaggMessageHandler
from fastmcp.client import FastMCPTransport, Client

class Riglm2MaggIntegration:
    def __init__(self, config_path: str):
        self.server = MaggServer(config_path)
        self.client = None
        self.handler = MaggMessageHandler(
            on_tool_list_changed=self._on_tools_changed,
        )

    async def start(self):
        await self.server.__aenter__()

        # Create client with message handler
        transport = FastMCPTransport(self.server.mcp)
        self.client = Client(transport, message_handler=self.handler)

    async def stop(self):
        if self.client:
            await self.client.close()
        await self.server.__aexit__(None, None, None)

    def _on_tools_changed(self, notification):
        # Notify riglm2 core
        self.refresh_tools()

    def refresh_tools(self):
        # Called when tools change
        pass

    async def list_tools(self):
        async with self.client:
            return await self.client.list_tools()

    async def call_tool(self, name: str, args: dict):
        async with self.client:
            return await self.client.call_tool(name, args)
```

---

## Environment Setup

### Installation

```bash
# pip
pip install magg

# uv
uv pip install magg

# pipx (for CLI usage)
pipx install magg
```

### Verify Installation

```bash
magg --version
magg --help
```

### Create Config

```bash
mkdir -p ~/.magg
cat > ~/.magg/config.json << 'EOF'
{
  "servers": {
    "calculator": {
      "source": "https://github.com/modelcontextprotocol/servers",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-calculator"],
      "prefix": "calc"
    }
  }
}
EOF
```

### Test Connection

```bash
# Start server
magg serve &

# Test with mbro (Magg browser)
mbro connect magg "magg serve"
mbro:magg> tools
```

---

## Docker Integration

### Dockerfile

```dockerfile
FROM python:3.11-slim

# Install Magg
RUN pip install magg

# Install Node.js for npx servers
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Copy config
COPY config.json /root/.magg/config.json

# Run Magg
CMD ["magg", "serve", "--http", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  magg:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./config.json:/root/.magg/config.json
      - ./kits:/root/.magg/kit.d
    environment:
      - MAGG_LOG_LEVEL=INFO
      - MAGG_AUTO_RELOAD=true
```

---

## Signal Handling

### Graceful Shutdown

Magg handles SIGINT and SIGTERM for graceful shutdown:

```python
# Programmatic shutdown
runner._shutdown_event.set()
```

### Config Reload

SIGHUP triggers config reload:

```bash
kill -HUP $(pgrep -f "magg serve")
```

---

## Error Handling

### Connection Errors

```python
try:
    async with client:
        tools = await client.list_tools()
except Exception as e:
    print(f"Connection error: {e}")
```

### Tool Call Errors

```python
try:
    result = await client.call_tool("nonexistent_tool", {})
except Exception as e:
    print(f"Tool call error: {e}")
```

### Reload Errors

```python
success = await server.reload_config()
if not success:
    print("Config reload failed - check logs")
```

---

## Testing Integration

### Unit Test Setup

```python
import pytest
from magg.server.server import MaggServer
from fastmcp.client import FastMCPTransport, Client

@pytest.fixture
async def magg_client():
    server = MaggServer(config_path="test_config.json")
    async with server:
        transport = FastMCPTransport(server.mcp)
        client = Client(transport)
        yield client

async def test_list_tools(magg_client):
    async with magg_client:
        tools = await magg_client.list_tools()
        assert len(tools) > 0
```

### Integration Test

```python
async def test_full_workflow():
    server = MaggServer()
    async with server:
        transport = FastMCPTransport(server.mcp)
        client = Client(transport)

        async with client:
            # List tools
            tools = await client.list_tools()

            # Add server via tool
            await client.call_tool("magg_add_server", {
                "source": "https://github.com/example/mcp",
                "name": "test-server",
                "command": "npx",
                "args": ["-y", "@example/mcp"],
            })

            # Verify server added
            tools = await client.list_tools()
            assert any(t.name.startswith("test-server") for t in tools)
```
