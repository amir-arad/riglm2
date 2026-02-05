# Integration Testing MCP Servers

## Table of Contents

1. [Transport Options](#transport-options)
2. [Multi-Tool Workflows](#multi-tool-workflows)
3. [Concurrent Request Handling](#concurrent-request-handling)
4. [Session State Persistence](#session-state-persistence)
5. [Error Handling](#error-handling)
6. [Timeout Configuration](#timeout-configuration)
7. [Request Cancellation](#request-cancellation)

## Transport Options

| Transport | Use Case | When to Use |
|-----------|----------|-------------|
| `InMemoryTransport` | Unit-like integration | Default for most tests |
| `StdioClientTransport` | Process spawning | Testing actual process lifecycle |
| `StreamableHTTPClientTransport` | HTTP servers | Testing HTTP-based servers |

### StdioClientTransport Example

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("Stdio Integration", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: ["build/index.js"],
      env: { NODE_ENV: "test" }
    });

    client = new Client(
      { name: "integration-client", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
  });

  afterEach(async () => {
    await client.close();
  });

  it("should communicate with spawned process", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBeGreaterThan(0);
  });
});
```

### StreamableHTTPClientTransport Example

```typescript
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);

const client = new Client(
  { name: "http-client", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

await client.connect(transport);
```

## Multi-Tool Workflows

Test chains where output from one tool feeds into another:

```typescript
describe("Multi-Tool Workflows", () => {
  it("should execute pipeline: fetch -> process -> validate", async () => {
    // Step 1: Fetch data
    const fetchResult = await client.callTool({
      name: "fetch_data",
      arguments: { source: "database", table: "users" }
    });
    const data = JSON.parse(fetchResult.content[0].text);
    expect(data.records).toBeDefined();

    // Step 2: Process using result from step 1
    const processResult = await client.callTool({
      name: "process_data",
      arguments: {
        records: data.records,
        operation: "transform"
      }
    });
    const processedId = JSON.parse(processResult.content[0].text).id;

    // Step 3: Validate entire workflow
    const validateResult = await client.callTool({
      name: "validate",
      arguments: { process_id: processedId }
    });

    expect(JSON.parse(validateResult.content[0].text)).toEqual({
      status: "success",
      validated: true
    });
  });

  it("should handle workflow with conditional branching", async () => {
    const analyzeResult = await client.callTool({
      name: "analyze",
      arguments: { input: "test data" }
    });
    const analysis = JSON.parse(analyzeResult.content[0].text);

    // Branch based on analysis result
    const nextTool = analysis.complexity > 5 ? "deep_process" : "quick_process";

    const result = await client.callTool({
      name: nextTool,
      arguments: { data: analysis.data }
    });

    expect(result.content[0].text).toContain("processed");
  });
});
```

## Concurrent Request Handling

Verify server handles parallel requests correctly:

```typescript
describe("Concurrency", () => {
  it("should handle 10 concurrent requests without race conditions", async () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      client.callTool({
        name: "process_item",
        arguments: { id: i, data: `item-${i}` }
      })
    );

    const results = await Promise.all(requests);

    // All completed
    expect(results).toHaveLength(10);

    // Each result corresponds to correct input (no cross-contamination)
    results.forEach((result, i) => {
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(i);
      expect(parsed.processed).toBe(`item-${i}`);
    });
  });

  it("should maintain order with Promise.allSettled", async () => {
    const requests = [
      client.callTool({ name: "slow_tool", arguments: { delay: 100 } }),
      client.callTool({ name: "fast_tool", arguments: {} }),
      client.callTool({ name: "failing_tool", arguments: {} })
    ];

    const results = await Promise.allSettled(requests);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("fulfilled");
    expect(results[2].status).toBe("rejected");
  });

  it("should handle high concurrency load", async () => {
    const CONCURRENT_REQUESTS = 50;

    const start = Date.now();
    const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
      client.callTool({ name: "echo", arguments: { value: i } })
    );

    const results = await Promise.all(requests);
    const duration = Date.now() - start;

    expect(results).toHaveLength(CONCURRENT_REQUESTS);
    console.log(`${CONCURRENT_REQUESTS} requests completed in ${duration}ms`);
  });
});
```

## Session State Persistence

Test stateful servers that maintain context:

```typescript
describe("Session State", () => {
  it("should persist state between requests", async () => {
    // Set context
    await client.callTool({
      name: "set_context",
      arguments: { key: "user_id", value: "user-123" }
    });

    await client.callTool({
      name: "set_context",
      arguments: { key: "session_data", value: JSON.stringify({ role: "admin" }) }
    });

    // Verify persistence
    const result1 = await client.callTool({
      name: "get_context",
      arguments: { key: "user_id" }
    });
    expect(result1.content[0].text).toBe("user-123");

    const result2 = await client.callTool({
      name: "get_context",
      arguments: { key: "session_data" }
    });
    expect(JSON.parse(result2.content[0].text)).toEqual({ role: "admin" });
  });

  it("should isolate state between different clients", async () => {
    // Create second client
    const client2 = new Client(
      { name: "test-client-2", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    const [ct2, st2] = InMemoryTransport.createLinkedPair();
    const server2 = createServer();
    await Promise.all([client2.connect(ct2), server2.connect(st2)]);

    // Client 1 sets value
    await client.callTool({
      name: "set_context",
      arguments: { key: "data", value: "client1_secret" }
    });

    // Client 2 should NOT see client 1's data
    const result = await client2.callTool({
      name: "get_context",
      arguments: { key: "data" }
    });

    expect(result.content[0].text).toBe("Not found");

    await client2.close();
    await server2.close();
  });

  it("should clear state on session end", async () => {
    await client.callTool({
      name: "set_context",
      arguments: { key: "temp", value: "data" }
    });

    // Close and reconnect
    await client.close();

    const [newCT, newST] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(newCT),
      server.connect(newST)
    ]);

    const result = await client.callTool({
      name: "get_context",
      arguments: { key: "temp" }
    });

    expect(result.content[0].text).toBe("Not found");
  });
});
```

## Error Handling

### Using McpError

```typescript
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Server-side error throwing
server.tool("risky_operation", { data: z.string() }, async ({ data }) => {
  if (!data.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "Data cannot be empty");
  }

  if (data === "trigger_error") {
    throw new McpError(ErrorCode.InternalError, "Simulated internal error");
  }

  return { content: [{ type: "text", text: "Success" }] };
});

// Tests
describe("Error Handling", () => {
  it("should propagate InvalidParams error", async () => {
    try {
      await client.callTool({
        name: "risky_operation",
        arguments: { data: "   " }
      });
      fail("Expected error");
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain("cannot be empty");
    }
  });

  it("should propagate InternalError", async () => {
    await expect(
      client.callTool({
        name: "risky_operation",
        arguments: { data: "trigger_error" }
      })
    ).rejects.toMatchObject({
      code: ErrorCode.InternalError
    });
  });

  it("should handle tool not found", async () => {
    await expect(
      client.callTool({
        name: "nonexistent_tool",
        arguments: {}
      })
    ).rejects.toMatchObject({
      code: -32601 // MethodNotFound
    });
  });
});
```

### Using isError Flag

```typescript
server.tool("safe_operation", { input: z.string() }, async ({ input }) => {
  if (input.length > 100) {
    return {
      content: [{ type: "text", text: "Input too long" }],
      isError: true
    };
  }
  return { content: [{ type: "text", text: "OK" }] };
});

it("should return error via isError flag", async () => {
  const result = await client.callTool({
    name: "safe_operation",
    arguments: { input: "x".repeat(150) }
  });

  expect(result.isError).toBe(true);
  expect(result.content[0].text).toBe("Input too long");
});
```

## Timeout Configuration

```typescript
describe("Timeouts", () => {
  it("should timeout on slow operations", async () => {
    server.tool("slow_tool", {}, async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return { content: [{ type: "text", text: "Done" }] };
    });

    await expect(
      client.callTool(
        { name: "slow_tool", arguments: {} },
        { timeout: 100 } // 100ms timeout
      )
    ).rejects.toMatchObject({
      code: -32001 // RequestTimeout
    });
  });

  it("should reset timeout on progress", async () => {
    server.tool("progressive_tool", {}, async (args, extra) => {
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        await extra.reportProgress({ progress: i + 1, total: 5 });
      }
      return { content: [{ type: "text", text: "Complete" }] };
    });

    const progressUpdates: number[] = [];

    const result = await client.callTool(
      { name: "progressive_tool", arguments: {} },
      {
        timeout: 500,
        resetTimeoutOnProgress: true,
        onprogress: (p) => progressUpdates.push(p.progress)
      }
    );

    expect(result.content[0].text).toBe("Complete");
    expect(progressUpdates).toEqual([1, 2, 3, 4, 5]);
  });
});
```

## Request Cancellation

```typescript
describe("Cancellation", () => {
  it("should cancel request with AbortController", async () => {
    server.tool("long_operation", {}, async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return { content: [{ type: "text", text: "Done" }] };
    });

    const controller = new AbortController();

    const promise = client.callTool(
      { name: "long_operation", arguments: {} },
      { signal: controller.signal }
    );

    // Cancel after 100ms
    setTimeout(() => controller.abort(), 100);

    await expect(promise).rejects.toThrow();
  });

  it("should handle abort reason", async () => {
    const controller = new AbortController();

    const promise = client.callTool(
      { name: "slow_tool", arguments: {} },
      { signal: controller.signal }
    );

    controller.abort(new Error("User cancelled"));

    try {
      await promise;
    } catch (error) {
      expect(error.message).toContain("cancelled");
    }
  });
});
```
