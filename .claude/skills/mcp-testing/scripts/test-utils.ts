/**
 * MCP Server Test Utilities
 *
 * Reusable helpers for testing MCP servers with InMemoryTransport.
 * Copy this file into your project's test directory.
 *
 * Usage:
 *   import { createTestContext, expectToolResult } from "./test-utils";
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Test context containing connected client and server
 */
export interface TestContext {
  client: Client;
  server: McpServer;
  cleanup: () => Promise<void>;
}

/**
 * Options for creating test context
 */
export interface TestContextOptions {
  clientName?: string;
  clientVersion?: string;
  capabilities?: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
  };
}

/**
 * Create a connected test context with client and server
 *
 * @example
 * ```typescript
 * let ctx: TestContext;
 *
 * beforeEach(async () => {
 *   ctx = await createTestContext(createServer());
 * });
 *
 * afterEach(async () => {
 *   await ctx.cleanup();
 * });
 *
 * it("should list tools", async () => {
 *   const result = await ctx.client.listTools();
 *   expect(result.tools.length).toBeGreaterThan(0);
 * });
 * ```
 */
export async function createTestContext(
  server: McpServer,
  options: TestContextOptions = {}
): Promise<TestContext> {
  const {
    clientName = "test-client",
    clientVersion = "1.0.0",
    capabilities = { tools: {}, resources: {}, prompts: {} },
  } = options;

  const client = new Client(
    { name: clientName, version: clientVersion },
    { capabilities }
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return {
    client,
    server,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}

/**
 * Create multiple connected clients to the same server
 * Useful for testing session isolation
 */
export async function createMultiClientContext(
  serverFactory: () => McpServer,
  clientCount: number
): Promise<{
  clients: Client[];
  servers: McpServer[];
  cleanup: () => Promise<void>;
}> {
  const clients: Client[] = [];
  const servers: McpServer[] = [];

  for (let i = 0; i < clientCount; i++) {
    const server = serverFactory();
    const client = new Client(
      { name: `test-client-${i}`, version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    clients.push(client);
    servers.push(server);
  }

  return {
    clients,
    servers,
    cleanup: async () => {
      await Promise.all([
        ...clients.map((c) => c.close()),
        ...servers.map((s) => s.close()),
      ]);
    },
  };
}

/**
 * Helper to extract text content from tool result
 */
export function getToolResultText(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const textContent = result.content.find((c) => c.type === "text");
  if (!textContent || !textContent.text) {
    throw new Error("No text content in tool result");
  }
  return textContent.text;
}

/**
 * Helper to extract and parse JSON from tool result
 */
export function getToolResultJson<T = unknown>(result: {
  content: Array<{ type: string; text?: string }>;
}): T {
  const text = getToolResultText(result);
  return JSON.parse(text) as T;
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Run a function with a timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  message = "Operation timed out"
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeout)
    ),
  ]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Assert that a tool exists with expected schema
 */
export async function assertToolExists(
  client: Client,
  toolName: string,
  expectedProperties?: Record<string, unknown>
): Promise<void> {
  const result = await client.listTools();
  const tool = result.tools.find((t) => t.name === toolName);

  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }

  if (expectedProperties) {
    const schema = tool.inputSchema as { properties?: Record<string, unknown> };
    for (const [key, value] of Object.entries(expectedProperties)) {
      if (JSON.stringify(schema.properties?.[key]) !== JSON.stringify(value)) {
        throw new Error(
          `Tool '${toolName}' property '${key}' does not match expected schema`
        );
      }
    }
  }
}

/**
 * Assert that a resource exists
 */
export async function assertResourceExists(
  client: Client,
  uriPattern: string | RegExp
): Promise<void> {
  const result = await client.listResources();

  const found = result.resources.some((r) =>
    typeof uriPattern === "string"
      ? r.uri === uriPattern
      : uriPattern.test(r.uri)
  );

  if (!found) {
    throw new Error(`Resource matching '${uriPattern}' not found`);
  }
}

/**
 * Assert that a prompt exists
 */
export async function assertPromptExists(
  client: Client,
  promptName: string
): Promise<void> {
  const result = await client.listPrompts();
  const prompt = result.prompts.find((p) => p.name === promptName);

  if (!prompt) {
    throw new Error(`Prompt '${promptName}' not found`);
  }
}

/**
 * Create a mock function that can be used for dependency injection
 */
export function createMockFn<T extends (...args: unknown[]) => unknown>(
  implementation?: T
): T & {
  calls: Parameters<T>[];
  mockReturnValue: (value: ReturnType<T>) => void;
  mockImplementation: (fn: T) => void;
} {
  let currentImpl = implementation;
  const calls: Parameters<T>[] = [];

  const mockFn = ((...args: Parameters<T>) => {
    calls.push(args);
    return currentImpl?.(...args);
  }) as T & {
    calls: Parameters<T>[];
    mockReturnValue: (value: ReturnType<T>) => void;
    mockImplementation: (fn: T) => void;
  };

  mockFn.calls = calls;
  mockFn.mockReturnValue = (value: ReturnType<T>) => {
    currentImpl = (() => value) as T;
  };
  mockFn.mockImplementation = (fn: T) => {
    currentImpl = fn;
  };

  return mockFn;
}
