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

describe("riglm2 proxy", () => {
  test("connects and lists namespaced tools + meta-tools", async () => {
    await setup();
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(2);

    const upstreamTools = tools.filter((t) => t.name.startsWith("everything__"));
    expect(upstreamTools.length).toBeGreaterThan(0);

    const metaNames = tools.map((t) => t.name);
    expect(metaNames).toContain("set_context");
    expect(metaNames).toContain("search_available_tools");

    const firstUpstream = upstreamTools[0]!;
    expect(firstUpstream.description).toMatch(/^\[everything\]/);
  }, 30_000);

  test("routes tool call to upstream", async () => {
    const result = await client.callTool({
      name: "everything__echo",
      arguments: { message: "hello from riglm2" },
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  }, 15_000);

  test("set_context meta-tool works", async () => {
    const result = await client.callTool({
      name: "set_context",
      arguments: { query: "I want to manage files", intent: "file-management" },
    });

    const text = firstText(result);
    expect(text).toContain("Context updated");
    expect(text).toContain("file-management");
  }, 15_000);

  test("search_available_tools meta-tool works", async () => {
    const result = await client.callTool({
      name: "search_available_tools",
      arguments: { query: "echo" },
    });

    const text = firstText(result);
    expect(text).toContain("everything__echo");
  }, 15_000);

  test("returns error for unknown tool", async () => {
    const result = await client.callTool({
      name: "nonexistent__tool",
      arguments: {},
    });

    const text = firstText(result);
    expect(text).toContain("Unknown tool");
  }, 15_000);
});
