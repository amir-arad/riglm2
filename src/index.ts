import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { UpstreamManager } from "./upstream-manager.js";
import { ToolRegistry } from "./tool-registry.js";
import { SessionStore } from "./session-store.js";
import { FastEmbedEmbedder } from "./embedder.js";
import { ToolRetriever } from "./tool-retriever.js";
import { Storage } from "./storage.js";
import { createProxyServer } from "./proxy-server.js";
import { log } from "./log.js";

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    log.error("Usage: riglm2 <config.json>");
    process.exit(1);
  }

  const config = await loadConfig(configPath);
  log.info(`Loaded config: ${config.servers.length} server(s)`);

  const upstream = new UpstreamManager();
  const connections = await upstream.connectAll(config.servers);

  if (connections.length === 0) {
    log.error("No upstream servers connected. Exiting.");
    process.exit(1);
  }

  const registry = new ToolRegistry(config.proxy.namespace_separator);
  registry.buildFromConnections(connections);
  log.info(`Tool registry: ${registry.size} tools from ${connections.length} server(s)`);

  const storagePath = path.resolve(path.dirname(configPath), config.storage.path);
  const storage = new Storage(storagePath);
  storage.prune(config.storage);
  const embedder = new FastEmbedEmbedder();
  const retriever = new ToolRetriever(embedder, registry, storage);
  retriever.loadDynamicEntries();
  await retriever.indexStaticTools();

  const sessionStore = new SessionStore();
  const server = createProxyServer(
    config.proxy.name,
    registry,
    upstream,
    sessionStore,
    retriever
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("riglm2 proxy running on stdio");

  const shutdown = async () => {
    log.info("Shutting down...");
    storage.prune(config.storage);
    storage.close();
    await upstream.disconnectAll();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("Fatal:", err);
  process.exit(1);
});
