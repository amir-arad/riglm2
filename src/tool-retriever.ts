import type { Embedder } from "./embedder.js";
import type { ToolRegistry } from "./tool-registry.js";
import { InMemoryVectorIndex } from "./vector-index.js";
import type { SearchResult } from "./vector-index.js";
import { log } from "./log.js";

const STATIC_WEIGHT = 0.6;
const DYNAMIC_WEIGHT = 0.4;
const DEFAULT_TOP_K = 15;
const CONFIDENCE_QUERY_K = 10;
const COLD_START_THRESHOLD = 0.3;

export class ToolRetriever {
  private staticIndex = new InMemoryVectorIndex();
  private dynamicIndex = new InMemoryVectorIndex();
  private embedder: Embedder;
  private registry: ToolRegistry;

  constructor(embedder: Embedder, registry: ToolRegistry) {
    this.embedder = embedder;
    this.registry = registry;
  }

  async indexStaticTools(): Promise<void> {
    const entries = this.registry.getAllEntries();
    if (entries.length === 0) return;

    const texts = entries.map(
      (e) => `${e.namespacedName}: ${e.definition.description ?? ""}`
    );
    const vectors = await this.embedder.embedBatch(texts);

    this.staticIndex.clear();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const vector = vectors[i];
      if (!entry || !vector) continue;
      this.staticIndex.add({
        id: `static:${entry.namespacedName}`,
        vector,
        toolName: entry.namespacedName,
        metadata: { type: "static" },
      });
    }

    log.info(`Indexed ${entries.length} tools in static embedding index`);
  }

  async retrieve(query: string, topK = DEFAULT_TOP_K): Promise<string[]> {
    const queryVector = await this.embedder.embed(query);

    const staticResults = this.staticIndex.search(queryVector, topK * 2);
    const dynamicResults =
      this.dynamicIndex.size > 0
        ? this.dynamicIndex.search(queryVector, topK * 2)
        : [];

    const combined = this.mergeResults(staticResults, dynamicResults);
    return combined.slice(0, topK).map((r) => r.toolName);
  }

  async recordLearning(
    query: string,
    toolName: string,
    signal: number
  ): Promise<void> {
    const id = `learned:${simpleHash(query)}:${toolName}`;
    const existing = this.dynamicIndex.get(id);

    if (existing) {
      const oldConfidence = existing.metadata.confidence ?? 0;
      existing.metadata.confidence = oldConfidence * 0.8 + signal * 0.2;
      return;
    }

    const queryVector = await this.embedder.embed(query);
    this.dynamicIndex.add({
      id,
      vector: queryVector,
      toolName,
      metadata: {
        type: "learned",
        confidence: signal,
        query,
      },
    });

    log.debug(
      `Learned: "${query}" → ${toolName} (signal=${signal}, dynamic_size=${this.dynamicIndex.size})`
    );
  }

  async contextConfidence(query: string): Promise<number> {
    if (this.dynamicIndex.size === 0) return 0;

    const queryVector = await this.embedder.embed(query);
    const results = this.dynamicIndex.search(queryVector, CONFIDENCE_QUERY_K);

    if (results.length === 0) return 0;

    const avgScore =
      results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const density = results.length / CONFIDENCE_QUERY_K;

    return avgScore * density;
  }

  get coldStartThreshold(): number {
    return COLD_START_THRESHOLD;
  }

  private mergeResults(
    staticResults: SearchResult[],
    dynamicResults: SearchResult[]
  ): SearchResult[] {
    const merged = new Map<string, { score: number; result: SearchResult }>();

    for (const r of staticResults) {
      merged.set(r.toolName, {
        score: r.score * STATIC_WEIGHT,
        result: r,
      });
    }

    for (const r of dynamicResults) {
      const existing = merged.get(r.toolName);
      if (existing) {
        existing.score += r.score * DYNAMIC_WEIGHT;
      } else {
        merged.set(r.toolName, {
          score: r.score * DYNAMIC_WEIGHT,
          result: r,
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .map((m) => ({ ...m.result, score: m.score }));
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
