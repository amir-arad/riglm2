import type { UpstreamConnection, UpstreamTool, ToolEntry } from "./types.js";

export class ToolRegistry {
  private entries = new Map<string, ToolEntry>();
  private separator: string;

  constructor(separator = "__") {
    this.separator = separator;
  }

  buildFromConnections(connections: UpstreamConnection[]): void {
    this.entries.clear();
    for (const conn of connections) {
      for (const tool of conn.tools) {
        const namespacedName = `${conn.name}${this.separator}${tool.name}`;

        const definition: UpstreamTool = {
          ...tool,
          name: namespacedName,
          description: tool.description
            ? `[${conn.name}] ${tool.description}`
            : `[${conn.name}]`,
        };

        this.entries.set(namespacedName, {
          namespacedName,
          originalName: tool.name,
          serverName: conn.name,
          definition,
        });
      }
    }
  }

  getAllTools(): UpstreamTool[] {
    return Array.from(this.entries.values()).map((e) => e.definition);
  }

  getEntry(namespacedName: string): ToolEntry | undefined {
    return this.entries.get(namespacedName);
  }

  parseName(namespacedName: string): [string, string] | null {
    const idx = namespacedName.indexOf(this.separator);
    if (idx === -1) return null;
    return [
      namespacedName.slice(0, idx),
      namespacedName.slice(idx + this.separator.length),
    ];
  }

  search(query: string): ToolEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.entries.values()).filter(
      (e) =>
        e.namespacedName.toLowerCase().includes(q) ||
        (e.definition.description?.toLowerCase().includes(q) ?? false)
    );
  }

  get size(): number {
    return this.entries.size;
  }
}
