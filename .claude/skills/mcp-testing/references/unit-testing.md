# Unit Testing MCP Servers

## Table of Contents

1. [Core SDK Classes](#core-sdk-classes)
2. [Complete Test Setup](#complete-test-setup)
3. [Testing Tools](#testing-tools)
4. [Testing Resources](#testing-resources)
5. [Testing Prompts](#testing-prompts)
6. [Mocking Dependencies](#mocking-dependencies)
7. [Reusable Test Context](#reusable-test-context)

## Core SDK Classes

| Class | Import Path | Purpose |
|-------|-------------|---------|
| `McpServer` | `@modelcontextprotocol/sdk/server/mcp.js` | High-level server wrapper |
| `Client` | `@modelcontextprotocol/sdk/client/index.js` | Client for connecting to servers |
| `InMemoryTransport` | `@modelcontextprotocol/sdk/inMemory.js` | In-memory transport for testing |
| `ResourceTemplate` | `@modelcontextprotocol/sdk/server/mcp.js` | Define parameterized resources |

## Complete Test Setup

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Server factory function for fresh instances
function createServer() {
  const server = new McpServer({
    name: "test-server",
    version: "1.0.0"
  });

  server.tool(
    "add",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }]
    })
  );

  server.resource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    async (uri, { name }) => ({
      contents: [{ uri: uri.href, text: `Hello, ${name}!` }]
    })
  );

  return server;
}

describe("MCP Server Unit Tests", () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    server = createServer();
    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport)
    ]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("should list available tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("add");
  });

  it("should call tool with valid parameters", async () => {
    const result = await client.callTool({
      name: "add",
      arguments: { a: 5, b: 3 }
    });
    expect(result.content[0].text).toBe("8");
  });
});
```

## Testing Tools

### List Tools

```typescript
it("should list all registered tools", async () => {
  const result = await client.listTools();

  expect(result.tools).toContainEqual(
    expect.objectContaining({
      name: "add",
      inputSchema: expect.objectContaining({
        type: "object",
        properties: expect.objectContaining({
          a: { type: "number" },
          b: { type: "number" }
        })
      })
    })
  );
});
```

### Call Tool with Valid Input

```typescript
it("should execute tool and return result", async () => {
  const result = await client.callTool({
    name: "add",
    arguments: { a: 10, b: 20 }
  });

  expect(result.content).toHaveLength(1);
  expect(result.content[0]).toEqual({
    type: "text",
    text: "30"
  });
});
```

### Test Schema Validation

```typescript
it("should reject invalid parameters", async () => {
  await expect(
    client.callTool({
      name: "add",
      arguments: { a: "not a number", b: 5 }
    })
  ).rejects.toMatchObject({
    code: -32602 // InvalidParams
  });
});
```

### Test Tool with Complex Output

```typescript
server.tool(
  "analyze",
  { text: z.string() },
  async ({ text }) => ({
    content: [
      { type: "text", text: `Word count: ${text.split(" ").length}` },
      { type: "text", text: `Character count: ${text.length}` }
    ]
  })
);

it("should return multiple content items", async () => {
  const result = await client.callTool({
    name: "analyze",
    arguments: { text: "hello world" }
  });

  expect(result.content).toHaveLength(2);
  expect(result.content[0].text).toBe("Word count: 2");
  expect(result.content[1].text).toBe("Character count: 11");
});
```

## Testing Resources

### Read Static Resource

```typescript
server.resource(
  "config",
  "config://app",
  async () => ({
    contents: [{ uri: "config://app", text: '{"debug": true}' }]
  })
);

it("should read static resource", async () => {
  const result = await client.readResource({ uri: "config://app" });

  expect(result.contents).toHaveLength(1);
  expect(JSON.parse(result.contents[0].text)).toEqual({ debug: true });
});
```

### Read Parameterized Resource

```typescript
server.resource(
  "user",
  new ResourceTemplate("user://{id}", { list: undefined }),
  async (uri, { id }) => ({
    contents: [{ uri: uri.href, text: `User ${id}` }]
  })
);

it("should read parameterized resource", async () => {
  const result = await client.readResource({ uri: "user://123" });
  expect(result.contents[0].text).toBe("User 123");
});
```

### List Resources

```typescript
it("should list available resources", async () => {
  const result = await client.listResources();

  expect(result.resources).toContainEqual(
    expect.objectContaining({
      uri: "config://app",
      name: "config"
    })
  );
});
```

## Testing Prompts

### Get Prompt

```typescript
server.prompt(
  "summarize",
  { topic: z.string(), style: z.enum(["brief", "detailed"]).optional() },
  ({ topic, style = "brief" }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `Summarize ${topic} (${style})` }
    }]
  })
);

it("should get prompt with arguments", async () => {
  const result = await client.getPrompt({
    name: "summarize",
    arguments: { topic: "testing", style: "detailed" }
  });

  expect(result.messages).toHaveLength(1);
  expect(result.messages[0].content.text).toBe("Summarize testing (detailed)");
});
```

### List Prompts

```typescript
it("should list available prompts", async () => {
  const result = await client.listPrompts();

  expect(result.prompts).toContainEqual(
    expect.objectContaining({
      name: "summarize",
      arguments: expect.arrayContaining([
        expect.objectContaining({ name: "topic", required: true })
      ])
    })
  );
});
```

## Mocking Dependencies

### Dependency Injection Pattern

```typescript
// Server with injectable dependencies
function createServer(deps: {
  fetchData: (id: string) => Promise<{ name: string }>;
  saveData: (data: unknown) => Promise<void>;
}) {
  const server = new McpServer({ name: "data-server", version: "1.0.0" });

  server.tool(
    "get_user",
    { id: z.string() },
    async ({ id }) => {
      const data = await deps.fetchData(id);
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    }
  );

  server.tool(
    "save_user",
    { name: z.string() },
    async ({ name }) => {
      await deps.saveData({ name });
      return { content: [{ type: "text", text: "Saved" }] };
    }
  );

  return server;
}

// Test with mocks
describe("with mocked dependencies", () => {
  it("should use mocked fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ name: "Alice" });
    const mockSave = vi.fn();

    const server = createServer({
      fetchData: mockFetch,
      saveData: mockSave
    });

    // Connect client...

    const result = await client.callTool({
      name: "get_user",
      arguments: { id: "123" }
    });

    expect(mockFetch).toHaveBeenCalledWith("123");
    expect(JSON.parse(result.content[0].text).name).toBe("Alice");
  });
});
```

### Global Fetch Mocking

```typescript
import { vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: "mocked" })
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

## Reusable Test Context

Create a utility to reduce boilerplate:

```typescript
// test-utils.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface TestContext {
  client: Client;
  server: McpServer;
  cleanup: () => Promise<void>;
}

export async function createTestContext(server: McpServer): Promise<TestContext> {
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport)
  ]);

  return {
    client,
    server,
    cleanup: async () => {
      await client.close();
      await server.close();
    }
  };
}

// Usage in tests
describe("using test context", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext(createServer());
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("should work", async () => {
    const result = await ctx.client.listTools();
    expect(result.tools.length).toBeGreaterThan(0);
  });
});
```
