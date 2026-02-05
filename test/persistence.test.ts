import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Storage } from "../src/storage.js";
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

function tempDbPath(label: string): string {
  return path.join(tmpdir(), `riglm2-test-${label}-${Date.now()}.db`);
}

const dbFiles: string[] = [];

afterAll(() => {
  for (const f of dbFiles) {
    // WHY: WAL mode creates -wal and -shm sidecar files
    for (const suffix of ["", "-wal", "-shm"]) {
      try { unlinkSync(f + suffix); } catch { /* already cleaned */ }
    }
  }
});

describe("Persistence integration", () => {
  test("persisted learned pair changes retrieval that static index alone cannot", async () => {
    const dbPath = tempDbPath("roundtrip");
    dbFiles.push(dbPath);

    // WHY: learn an unlikely pairing — "query the database" → file_read
    // Static index would never rank file_read first for a database query
    // (db query vector is orthogonal to file_read vector)
    const storage1 = new Storage(dbPath);
    const retriever1 = new ToolRetriever(new MockEmbedder(), buildRegistry(), storage1);
    await retriever1.indexStaticTools();
    await retriever1.recordLearning("query the database", "test__file_read", 1.5);
    storage1.close();

    // WHY: control — without loading dynamic entries, file_read should NOT rank first
    const storageControl = new Storage(dbPath);
    const control = new ToolRetriever(new MockEmbedder(), buildRegistry(), storageControl);
    await control.indexStaticTools();
    const controlResults = await control.retrieve("query the database");
    expect(controlResults[0]).not.toBe("test__file_read");
    storageControl.close();

    // WHY: with dynamic entries loaded, the unlikely pairing should boost file_read
    const storage2 = new Storage(dbPath);
    const retriever2 = new ToolRetriever(new MockEmbedder(), buildRegistry(), storage2);
    retriever2.loadDynamicEntries();
    await retriever2.indexStaticTools();
    const results = await retriever2.retrieve("query the database");
    const fileReadRank = results.indexOf("test__file_read");
    const controlFileReadRank = controlResults.indexOf("test__file_read");
    expect(fileReadRank).toBeLessThan(controlFileReadRank);
    storage2.close();
  });

  test("confidence EMA update persists across restart", async () => {
    const dbPath = tempDbPath("confidence");
    dbFiles.push(dbPath);

    const storage1 = new Storage(dbPath);
    const retriever1 = new ToolRetriever(new MockEmbedder(), buildRegistry(), storage1);
    await retriever1.indexStaticTools();

    await retriever1.recordLearning("query the database", "test__db_query", 1.5);
    await retriever1.recordLearning("query the database", "test__db_query", 0.5);
    // WHY: EMA = 1.5 * 0.8 + 0.5 * 0.2 = 1.3
    storage1.close();

    const storage2 = new Storage(dbPath);
    const loaded = storage2.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.metadata.confidence).toBeCloseTo(1.3, 5);
    storage2.close();
  });

  test("learn → persist → prune → reload yields fewer entries", async () => {
    const dbPath = tempDbPath("prune-cycle");
    dbFiles.push(dbPath);

    const storage1 = new Storage(dbPath);
    const retriever1 = new ToolRetriever(new MockEmbedder(), buildRegistry(), storage1);
    await retriever1.indexStaticTools();

    // WHY: use different queries so each gets a unique hash → separate entries
    const queries = Array.from({ length: 10 }, (_, i) => `unique query number ${i}`);
    for (const q of queries) {
      await retriever1.recordLearning(q, "test__echo", (queries.indexOf(q) + 1) * 0.05);
    }
    expect(storage1.size()).toBe(10);
    storage1.close();

    const storage2 = new Storage(dbPath);
    const pruned = storage2.prune({
      pruneMinConfidence: 0.2,
      pruneUnusedDays: 9999,
      pruneThreshold: 9999,
    });
    expect(pruned).toBeGreaterThan(0);
    const sizeAfterPrune = storage2.size();
    expect(sizeAfterPrune).toBeLessThan(10);
    storage2.close();

    const storage3 = new Storage(dbPath);
    const retriever3 = new ToolRetriever(new MockEmbedder(), buildRegistry(), storage3);
    retriever3.loadDynamicEntries();
    const confidence = await retriever3.contextConfidence("unique query number 9");
    expect(confidence).toBeGreaterThan(0);
    storage3.close();
  });

  test("DB file is created on disk", () => {
    const dbPath = tempDbPath("create");
    dbFiles.push(dbPath);

    expect(existsSync(dbPath)).toBe(false);
    const storage = new Storage(dbPath);
    expect(existsSync(dbPath)).toBe(true);
    storage.close();
  });
});
