import { describe, test, expect } from "bun:test";
import { InMemoryVectorIndex } from "../src/vector-index.js";
import type { VectorEntry } from "../src/vector-index.js";

function makeEntry(
  id: string,
  toolName: string,
  vector: number[]
): VectorEntry {
  return {
    id,
    vector,
    toolName,
    metadata: { type: "static" },
  };
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

describe("InMemoryVectorIndex", () => {
  test("add and search returns closest vectors", () => {
    const index = new InMemoryVectorIndex();

    index.add(makeEntry("a", "tool-a", normalize([1, 0, 0])));
    index.add(makeEntry("b", "tool-b", normalize([0, 1, 0])));
    index.add(makeEntry("c", "tool-c", normalize([0, 0, 1])));
    index.add(makeEntry("d", "tool-d", normalize([0.9, 0.1, 0])));

    const results = index.search(normalize([1, 0, 0]), 2);

    expect(results).toHaveLength(2);
    expect(results[0]!.toolName).toBe("tool-a");
    expect(results[1]!.toolName).toBe("tool-d");
  });

  test("addBatch works", () => {
    const index = new InMemoryVectorIndex();
    index.addBatch([
      makeEntry("a", "tool-a", normalize([1, 0, 0])),
      makeEntry("b", "tool-b", normalize([0, 1, 0])),
    ]);

    expect(index.size).toBe(2);
  });

  test("remove deletes entry", () => {
    const index = new InMemoryVectorIndex();
    index.add(makeEntry("a", "tool-a", normalize([1, 0, 0])));
    expect(index.size).toBe(1);

    index.remove("a");
    expect(index.size).toBe(0);
  });

  test("upsert overwrites existing entry", () => {
    const index = new InMemoryVectorIndex();
    index.add(makeEntry("a", "tool-a", normalize([1, 0, 0])));
    index.add(makeEntry("a", "tool-a", normalize([0, 1, 0])));

    expect(index.size).toBe(1);
    const results = index.search(normalize([0, 1, 0]), 1);
    expect(results[0]!.score).toBeCloseTo(1.0, 2);
  });

  test("search returns empty for empty index", () => {
    const index = new InMemoryVectorIndex();
    expect(index.search([1, 0, 0], 5)).toHaveLength(0);
  });

  test("topK caps results", () => {
    const index = new InMemoryVectorIndex();
    for (let i = 0; i < 10; i++) {
      const v = Array.from({ length: 3 }, () => Math.random());
      index.add(makeEntry(`e${i}`, `tool-${i}`, normalize(v)));
    }

    expect(index.search(normalize([1, 0, 0]), 3)).toHaveLength(3);
  });

  test("clear empties the index", () => {
    const index = new InMemoryVectorIndex();
    index.add(makeEntry("a", "tool-a", normalize([1, 0, 0])));
    index.clear();
    expect(index.size).toBe(0);
  });
});
