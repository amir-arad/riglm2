---
name: mcp-testing
description: |
  Testing MCP (Model Context Protocol) servers using the TypeScript SDK and MCP Inspector CLI.
  Use when: (1) Writing unit tests for MCP tools, resources, or prompts, (2) Creating integration
  tests for MCP server workflows, (3) Setting up E2E tests with mcp-inspector CLI, (4) Testing
  MCP servers in CI/CD pipelines, (5) Mocking dependencies in MCP server tests, (6) Debugging
  MCP protocol errors or timeout issues.
---

# MCP Server Testing

Test MCP servers at three levels: **unit** (InMemoryTransport), **integration** (multi-tool workflows), and **E2E** (mcp-inspector CLI).

## Quick Reference

| Level | Tool | Use Case |
|-------|------|----------|
| Unit | `InMemoryTransport` | Fast, isolated tool/resource/prompt tests |
| Integration | `InMemoryTransport` or `StdioClientTransport` | Multi-tool workflows, state, concurrency |
| E2E | `npx @modelcontextprotocol/inspector --cli` | CI/CD validation, smoke tests |

## Unit Testing Pattern

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Create fresh instances per test
const server = new McpServer({ name: "test-server", version: "1.0.0" });
const client = new Client(
  { name: "test-client", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// Connect via linked transports
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport)
]);

// Test
const result = await client.callTool({ name: "my_tool", arguments: { x: 1 } });

// Cleanup
await client.close();
await server.close();
```

## E2E with Inspector CLI

```bash
# List tools
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list

# Call tool
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name search \
  --tool-arg query="test"

# With environment variables
npx @modelcontextprotocol/inspector --cli \
  -e API_KEY=$API_KEY \
  node build/index.js --method tools/list
```

## References

- **Unit tests**: See [references/unit-testing.md](references/unit-testing.md) for complete patterns
- **Integration tests**: See [references/integration-testing.md](references/integration-testing.md) for workflows, concurrency, errors
- **E2E tests**: See [references/e2e-testing.md](references/e2e-testing.md) for CLI usage and CI/CD
- **Test utilities**: See [scripts/test-utils.ts](scripts/test-utils.ts) for reusable helpers

## Common Error Codes

| Code | Name | Meaning |
|------|------|---------|
| -32602 | InvalidParams | Schema validation failed |
| -32603 | InternalError | Server-side error |
| -32001 | RequestTimeout | Operation timed out (default 60s) |

## Key Rules

1. **Register before connect**: All tools/resources/prompts must be registered before `server.connect()`
2. **Fresh instances**: Create new server/client per test to avoid state leakage
3. **Always cleanup**: Call `client.close()` and `server.close()` in afterEach
4. **Use dependency injection**: Inject external dependencies for mockability
