export interface VectorEntry {
  id: string;
  vector: number[];
  toolName: string;
  metadata: {
    type: "static" | "learned";
    confidence?: number;
    query?: string;
  };
}

export interface SearchResult {
  id: string;
  toolName: string;
  score: number;
  metadata: VectorEntry["metadata"];
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

export class InMemoryVectorIndex {
  private entries = new Map<string, VectorEntry>();

  add(entry: VectorEntry): void {
    this.entries.set(entry.id, entry);
  }

  addBatch(entries: VectorEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
  }

  search(queryVector: number[], topK: number): SearchResult[] {
    const scored: SearchResult[] = [];
    for (const entry of this.entries.values()) {
      scored.push({
        id: entry.id,
        toolName: entry.toolName,
        score: dotProduct(queryVector, entry.vector),
        metadata: entry.metadata,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
