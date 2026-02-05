import { describe, test, expect } from "bun:test";
import { Storage } from "../src/storage.js";
import type { VectorEntry } from "../src/vector-index.js";

function makeEntry(id: string, confidence: number, vector?: number[]): VectorEntry {
  return {
    id,
    vector: vector ?? [0.1, 0.2, 0.3, 0.4],
    toolName: `tool_${id}`,
    metadata: {
      type: "learned",
      confidence,
      query: `query for ${id}`,
    },
  };
}

describe("Storage", () => {
  test("roundtrip: upsert then loadAll", () => {
    const storage = new Storage(":memory:");
    const entry = makeEntry("e1", 0.8, [1.0, 2.0, 3.0]);

    storage.upsert(entry);
    const loaded = storage.loadAll();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.id).toBe("e1");
    expect(loaded[0]!.toolName).toBe("tool_e1");
    expect(loaded[0]!.metadata.confidence).toBe(0.8);
    expect(loaded[0]!.metadata.query).toBe("query for e1");
    expect(loaded[0]!.vector).toHaveLength(3);
    expect(loaded[0]!.vector[0]).toBeCloseTo(1.0);
    expect(loaded[0]!.vector[1]).toBeCloseTo(2.0);
    expect(loaded[0]!.vector[2]).toBeCloseTo(3.0);

    storage.close();
  });

  test("upsert updates confidence on conflict", () => {
    const storage = new Storage(":memory:");

    storage.upsert(makeEntry("e1", 0.5));
    storage.upsert(makeEntry("e1", 0.9));

    const loaded = storage.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.metadata.confidence).toBe(0.9);

    storage.close();
  });

  test("size tracks entry count", () => {
    const storage = new Storage(":memory:");

    expect(storage.size()).toBe(0);
    storage.upsert(makeEntry("e1", 0.5));
    expect(storage.size()).toBe(1);
    storage.upsert(makeEntry("e2", 0.6));
    expect(storage.size()).toBe(2);

    storage.close();
  });

  test("remove deletes entry", () => {
    const storage = new Storage(":memory:");

    storage.upsert(makeEntry("e1", 0.5));
    storage.remove("e1");

    expect(storage.size()).toBe(0);
    expect(storage.loadAll()).toHaveLength(0);

    storage.close();
  });

  test("empty DB: loadAll returns [], size returns 0", () => {
    const storage = new Storage(":memory:");

    expect(storage.loadAll()).toEqual([]);
    expect(storage.size()).toBe(0);

    storage.close();
  });

  test("prune removes low-confidence entries", () => {
    const storage = new Storage(":memory:");

    storage.upsert(makeEntry("low", 0.05));
    storage.upsert(makeEntry("high", 0.8));

    const pruned = storage.prune({
      pruneMinConfidence: 0.1,
      pruneUnusedDays: 9999,
      pruneThreshold: 9999,
    });

    expect(pruned).toBe(1);
    expect(storage.size()).toBe(1);
    expect(storage.loadAll()[0]!.id).toBe("high");

    storage.close();
  });

  test("prune removes stale entries", () => {
    const storage = new Storage(":memory:");

    storage.upsert(makeEntry("old", 0.8));
    storage.upsert(makeEntry("recent", 0.8));

    // WHY: manually backdate last_used_at for the "old" entry
    const db = (storage as unknown as { db: { exec: (sql: string) => void } }).db;
    db.exec(
      `UPDATE dynamic_entries SET last_used_at = ${Math.floor(Date.now() / 1000) - 86400 * 60} WHERE id = 'old'`
    );

    const pruned = storage.prune({
      pruneMinConfidence: 0,
      pruneUnusedDays: 30,
      pruneThreshold: 9999,
    });

    expect(pruned).toBe(1);
    expect(storage.size()).toBe(1);
    expect(storage.loadAll()[0]!.id).toBe("recent");

    storage.close();
  });

  test("prune enforces size threshold", () => {
    const storage = new Storage(":memory:");

    for (let i = 0; i < 20; i++) {
      storage.upsert(makeEntry(`e${i}`, i * 0.05));
    }

    const pruned = storage.prune({
      pruneMinConfidence: 0,
      pruneUnusedDays: 9999,
      pruneThreshold: 10,
    });

    expect(pruned).toBeGreaterThan(0);
    expect(storage.size()).toBeLessThanOrEqual(10);

    const remaining = storage.loadAll();
    const confidences = remaining.map((e) => e.metadata.confidence ?? 0);
    for (const c of confidences) {
      expect(c).toBeGreaterThanOrEqual(0.5);
    }

    storage.close();
  });
});
