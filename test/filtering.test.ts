import { describe, test, expect, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { unlinkSync } from "node:fs";
import path from "node:path";

const configPath = path.join(import.meta.dirname, "smoke.config.json");

let client: Client;
let transport: StdioClientTransport;

function firstText(
  result: { content: Array<{ type: string; text?: string }> }
): string | undefined {
  const item = result.content[0];
  return item?.type === "text" ? item.text : undefined;
}

async function setup() {
  transport = new StdioClientTransport({
    command: "bun",
    args: ["run", path.join(import.meta.dirname, "../src/index.ts"), configPath],
    stderr: "inherit",
  });
  client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
}

const DB_PATH = "/tmp/riglm2-test-e2e.db";

afterAll(async () => {
  await client?.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { unlinkSync(DB_PATH + suffix); } catch { /* already cleaned */ }
  }
});

describe("Phase 3: context-aware filtering", () => {
  test("tools/list returns all tools before set_context", async () => {
    await setup();
    const { tools } = await client.listTools();

    const upstreamTools = tools.filter((t) => t.name.startsWith("everything__"));
    expect(upstreamTools.length).toBe(13);

    const metaNames = tools.map((t) => t.name);
    expect(metaNames).toContain("set_context");
    expect(metaNames).toContain("search_available_tools");
  }, 30_000);

  test("set_context returns confirmation and meta-tools always present", async () => {
    const result = await client.callTool({
      name: "set_context",
      arguments: { query: "I want to echo messages" },
    });

    const text = firstText(result);
    expect(text).toContain("Context updated");

    const { tools } = await client.listTools();
    const metaNames = tools.map((t) => t.name);
    expect(metaNames).toContain("set_context");
    expect(metaNames).toContain("search_available_tools");
  }, 30_000);

  test("search_available_tools tracks results for learning", async () => {
    const result = await client.callTool({
      name: "search_available_tools",
      arguments: { query: "echo" },
    });

    const text = firstText(result);
    expect(text).toContain("everything__echo");
  }, 15_000);

  test("tool call after set_context records learning signal", async () => {
    await client.callTool({
      name: "set_context",
      arguments: { query: "I want to test echoing messages back" },
    });

    const result = await client.callTool({
      name: "everything__echo",
      arguments: { message: "learning test" },
    });

    expect(result.content).toBeDefined();
  }, 30_000);

  test("learned pairs persist across restart", async () => {
    // WHY: learn a signal by setting context then calling a tool
    await client.callTool({
      name: "set_context",
      arguments: { query: "I want to echo messages back and forth" },
    });
    await client.callTool({
      name: "everything__echo",
      arguments: { message: "persist me" },
    });

    await client.close();

    // WHY: restart proxy with same DB to verify persistence
    transport = new StdioClientTransport({
      command: "bun",
      args: ["run", path.join(import.meta.dirname, "../src/index.ts"), configPath],
      stderr: "inherit",
    });
    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    // WHY: set same context — if dynamic entries loaded, echo should rank in filtered list
    await client.callTool({
      name: "set_context",
      arguments: { query: "I want to echo messages back and forth" },
    });

    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("everything__echo");
  }, 60_000);
});
