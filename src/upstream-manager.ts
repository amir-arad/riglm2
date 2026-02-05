import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ServerConfig } from "./config.js";
import { UpstreamToolSchema } from "./types.js";
import type { UpstreamConnection } from "./types.js";
import { log } from "./log.js";

export class UpstreamManager {
  private connections = new Map<string, UpstreamConnection>();

  async connectAll(servers: ServerConfig[]): Promise<UpstreamConnection[]> {
    const enabled = servers.filter((s) => s.enabled !== false);

    const results = await Promise.allSettled(
      enabled.map((server) => this.connectOne(server))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const server = enabled[i]!;
      if (result.status === "rejected") {
        log.error(
          `Failed to connect to "${server.name}": ${result.reason}`
        );
      }
    }

    return Array.from(this.connections.values());
  }

  private async connectOne(server: ServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: Object.fromEntries(
        Object.entries({ ...process.env, ...server.env }).filter(
          (pair): pair is [string, string] => pair[1] !== undefined
        )
      ),
      cwd: server.cwd,
      stderr: "inherit",
    });

    const client = new Client(
      { name: "riglm2", version: "0.1.0" },
      { capabilities: {} }
    );

    await client.connect(transport);

    const { tools } = await client.listTools();
    log.info(
      `Connected to "${server.name}": ${tools.length} tools`
    );

    this.connections.set(server.name, {
      name: server.name,
      client,
      tools: UpstreamToolSchema.array().parse(tools),
    });
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ) {
    const conn = this.connections.get(serverName);
    if (!conn) throw new Error(`No connection to server: ${serverName}`);
    return conn.client.callTool({ name: toolName, arguments: args });
  }

  getConnection(name: string): UpstreamConnection | undefined {
    return this.connections.get(name);
  }

  getAllConnections(): UpstreamConnection[] {
    return Array.from(this.connections.values());
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.values()).map(async (conn) => {
      try {
        await conn.client.close();
        log.info(`Disconnected from "${conn.name}"`);
      } catch (err) {
        log.error(`Error disconnecting from "${conn.name}": ${err}`);
      }
    });
    await Promise.allSettled(promises);
    this.connections.clear();
  }
}
