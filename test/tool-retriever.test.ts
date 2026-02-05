import { describe, test, expect } from "bun:test";
import { ToolRetriever } from "../src/tool-retriever.js";
import { ToolRegistry } from "../src/tool-registry.js";
import type { Embedder } from "../src/embedder.js";
import type { UpstreamConnection } from "../src/types.js";

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

const KEYWORD_VECTORS: Array<{ pattern: string; vector: number[] }> = [
  { pattern: "file_read", vector: normalize([0.9, 0.1, 0, 0]) },
  { pattern: "file_write", vector: normalize([0.8, 0.2, 0, 0]) },
  { pattern: "web_search", vector: normalize([0, 0, 0.9, 0.1]) },
  { pattern: "db_query", vector: normalize([0, 0.1, 0, 0.9]) },
  { pattern: "echo", vector: normalize([0.1, 0.1, 0.1, 0.1]) },
];

const QUERY_VECTORS: Record<string, number[]> = {
  "I need to read and write files": normalize([0.85, 0.15, 0, 0]),
  "search the web for info": normalize([0, 0, 0.95, 0.05]),
  "query the database": normalize([0, 0.05, 0, 0.95]),
};

class MockEmbedder implements Embedder {
  readonly dimensions = 4;

  async embed(text: string): Promise<number[]> {
    if (QUERY_VECTORS[text]) return QUERY_VECTORS[text];

    for (const { pattern, vector } of KEYWORD_VECTORS) {
      if (text.includes(pattern)) return vector;
    }

    return normalize([0.1, 0.1, 0.1, 0.1]);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const t of texts) {
      results.push(await this.embed(t));
    }
    return results;
  }
}

function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry("__");
  const conn: UpstreamConnection = {
    name: "test",
    client: {} as UpstreamConnection["client"],
    tools: [
      { name: "file_read", description: "Read a file from disk", inputSchema: { type: "object" as const } },
      { name: "file_write", description: "Write content to a file", inputSchema: { type: "object" as const } },
      { name: "web_search", description: "Search the internet", inputSchema: { type: "object" as const } },
      { name: "db_query", description: "Query a database", inputSchema: { type: "object" as const } },
      { name: "echo", description: "Echo input back", inputSchema: { type: "object" as const } },
    ],
  };
  registry.buildFromConnections([conn]);
  return registry;
}

describe("ToolRetriever", () => {
  test("indexStaticTools indexes all tools", async () => {
    const registry = buildRegistry();
    const retriever = new ToolRetriever(new MockEmbedder(), registry);
    await retriever.indexStaticTools();

    const results = await retriever.retrieve("I need to read and write files");
    expect(results.length).toBeGreaterThan(0);
  });

  test("retrieve ranks file tools highest for file query", async () => {
    const registry = buildRegistry();
    const retriever = new ToolRetriever(new MockEmbedder(), registry);
    await retriever.indexStaticTools();

    const results = await retriever.retrieve("I need to read and write files");
    expect(results[0]).toBe("test__file_read");
    expect(results[1]).toBe("test__file_write");
  });

  test("retrieve ranks web tools highest for web query", async () => {
    const registry = buildRegistry();
    const retriever = new ToolRetriever(new MockEmbedder(), registry);
    await retriever.indexStaticTools();

    const results = await retriever.retrieve("search the web for info");
    expect(results[0]).toBe("test__web_search");
  });

  test("contextConfidence returns 0 for empty dynamic index", async () => {
    const registry = buildRegistry();
    const retriever = new ToolRetriever(new MockEmbedder(), registry);
    await retriever.indexStaticTools();

    const confidence = await retriever.contextConfidence("anything");
    expect(confidence).toBe(0);
  });

  test("recordLearning adds to dynamic index", async () => {
    const registry = buildRegistry();
    const retriever = new ToolRetriever(new MockEmbedder(), registry);
    await retriever.indexStaticTools();

    await retriever.recordLearning("I need to read and write files", "test__file_read", 1.0);

    const confidence = await retriever.contextConfidence("I need to read and write files");
    expect(confidence).toBeGreaterThan(0);
  });

  test("learned pairs boost retrieval for similar queries", async () => {
    const registry = buildRegistry();
    const retriever = new ToolRetriever(new MockEmbedder(), registry);
    await retriever.indexStaticTools();

    await retriever.recordLearning("query the database", "test__db_query", 1.5);

    const results = await retriever.retrieve("query the database");
    expect(results[0]).toBe("test__db_query");
  });
});
