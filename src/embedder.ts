import { EmbeddingModel, FlagEmbedding } from "fastembed";
import { log } from "./log.js";

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

export class FastEmbedEmbedder implements Embedder {
  private model: FlagEmbedding | null = null;
  readonly dimensions = 384;

  private async getModel(): Promise<FlagEmbedding> {
    if (!this.model) {
      log.info("Loading embedding model BGE-small-en-v1.5...");
      this.model = await FlagEmbedding.init({
        model: EmbeddingModel.BGESmallENV15,
      });
      log.info("Embedding model loaded");
    }
    return this.model;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const vector = results[0];
    if (!vector) throw new Error("Embedding returned empty result");
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const model = await this.getModel();
    const vectors: number[][] = [];
    for await (const batch of model.embed(texts)) {
      vectors.push(...batch.map((v) => Array.from(v)));
    }
    return vectors;
  }
}
