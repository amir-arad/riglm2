import { Database, type Statement } from "bun:sqlite";
import type { VectorEntry } from "./vector-index.js";
import type { StorageConfig } from "./config.js";
import { log } from "./log.js";

export class Storage {
  private db: Database;
  private stmtLoadAll: Statement;
  private stmtUpsert: Statement;
  private stmtRemove: Statement;
  private stmtSize: Statement;

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dynamic_entries (
        id TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        tool_name TEXT NOT NULL,
        query TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_used_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_confidence ON dynamic_entries(confidence)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_last_used ON dynamic_entries(last_used_at)"
    );

    this.stmtLoadAll = this.db.query(
      "SELECT id, vector, tool_name, query, confidence FROM dynamic_entries"
    );
    this.stmtUpsert = this.db.query(
      `INSERT INTO dynamic_entries (id, vector, tool_name, query, confidence, last_used_at)
       VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())
       ON CONFLICT(id) DO UPDATE SET
         confidence = ?5,
         last_used_at = unixepoch()`
    );
    this.stmtRemove = this.db.query(
      "DELETE FROM dynamic_entries WHERE id = ?1"
    );
    this.stmtSize = this.db.query(
      "SELECT COUNT(*) as count FROM dynamic_entries"
    );
  }

  loadAll(): VectorEntry[] {
    const rows = this.stmtLoadAll.all() as Array<{
      id: string;
      vector: Buffer;
      tool_name: string;
      query: string;
      confidence: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      vector: Array.from(
        new Float64Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 8)
      ),
      toolName: row.tool_name,
      metadata: {
        type: "learned" as const,
        confidence: row.confidence,
        query: row.query,
      },
    }));
  }

  upsert(entry: VectorEntry): void {
    const vectorBlob = Buffer.from(
      new Float64Array(entry.vector).buffer
    );
    this.stmtUpsert.run(
      entry.id,
      vectorBlob,
      entry.toolName,
      entry.metadata.query ?? "",
      entry.metadata.confidence ?? 0
    );
  }

  remove(id: string): void {
    this.stmtRemove.run(id);
  }

  size(): number {
    const row = this.stmtSize.get() as { count: number };
    return row.count;
  }

  prune(config: Pick<StorageConfig, "pruneThreshold" | "pruneMinConfidence" | "pruneUnusedDays">): number {
    const tx = this.db.transaction(() => {
      let total = 0;

      const lowConf = this.db
        .query("DELETE FROM dynamic_entries WHERE confidence < ?1 RETURNING id")
        .all(config.pruneMinConfidence);
      total += lowConf.length;

      const cutoff = Math.floor(Date.now() / 1000) - config.pruneUnusedDays * 86400;
      const stale = this.db
        .query("DELETE FROM dynamic_entries WHERE last_used_at < ?1 RETURNING id")
        .all(cutoff);
      total += stale.length;

      const currentSize = this.size();
      if (currentSize > config.pruneThreshold) {
        const keep = Math.floor(config.pruneThreshold * 0.9);
        const excess = this.db
          .query(
            `DELETE FROM dynamic_entries WHERE id NOT IN (
              SELECT id FROM dynamic_entries ORDER BY confidence DESC LIMIT ?1
            ) RETURNING id`
          )
          .all(keep);
        total += excess.length;
      }

      return total;
    });

    const pruned = tx();
    if (pruned > 0) {
      log.info(`Pruned ${pruned} dynamic entries`);
    }
    return pruned;
  }

  close(): void {
    this.db.close();
  }
}
