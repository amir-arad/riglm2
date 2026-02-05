import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "./tool-registry.js";
import type { UpstreamManager } from "./upstream-manager.js";
import type { SessionStore } from "./session-store.js";
import type { ToolRetriever } from "./tool-retriever.js";
import {
  getMetaToolDefinitions,
  isMetaTool,
  handleMetaTool,
} from "./meta-tools.js";
import { log } from "./log.js";

const DEFAULT_SESSION = "default";
const STRONG_SIGNAL = 1.0;
const DISCOVERY_SIGNAL = 0.5;
const VERY_STRONG_SIGNAL = 1.5;

export function createProxyServer(
  name: string,
  registry: ToolRegistry,
  upstream: UpstreamManager,
  sessionStore: SessionStore,
  retriever?: ToolRetriever
): Server {
  const server = new Server(
    { name, version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const metaTools = getMetaToolDefinitions();
    const context = sessionStore.getContext(DEFAULT_SESSION);

    if (!context || !retriever) {
      const upstreamTools = registry.getAllTools();
      log.debug(
        `tools/list: ${upstreamTools.length} upstream + ${metaTools.length} meta (unfiltered)`
      );
      return { tools: [...upstreamTools, ...metaTools] };
    }

    const confidence = await retriever.contextConfidence(context.query);

    if (confidence < retriever.coldStartThreshold) {
      const upstreamTools = registry.getAllTools();
      log.debug(
        `tools/list: ${upstreamTools.length} upstream + ${metaTools.length} meta (cold start, confidence=${confidence.toFixed(2)})`
      );
      return { tools: [...upstreamTools, ...metaTools] };
    }

    const relevantNames = await retriever.retrieve(context.query);
    const filteredTools = relevantNames
      .map((name) => registry.getEntry(name)?.definition)
      .filter((d) => d !== undefined);

    sessionStore.setRetrievedTools(
      DEFAULT_SESSION,
      relevantNames
    );

    log.debug(
      `tools/list: ${filteredTools.length}/${registry.size} tools (confidence=${confidence.toFixed(2)})`
    );

    return { tools: [...filteredTools, ...metaTools] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;
    log.debug(`tools/call: ${toolName}`);

    if (isMetaTool(toolName)) {
      return handleMetaTool(
        toolName,
        args ?? {},
        registry,
        sessionStore,
        server
      );
    }

    const entry = registry.getEntry(toolName);
    if (!entry) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Unknown tool: ${toolName}` }],
      };
    }

    const result = await upstream.callTool(
      entry.serverName,
      entry.originalName,
      args ?? {}
    );

    sessionStore.recordToolCall(DEFAULT_SESSION, toolName);

    if (retriever) {
      const context = sessionStore.getContext(DEFAULT_SESSION);
      if (context) {
        const retrieved = sessionStore.getRetrievedTools(DEFAULT_SESSION);
        const lastSearch = sessionStore.getLastSearch(DEFAULT_SESSION);
        const wasRetrieved = retrieved?.includes(toolName) ?? false;
        const wasSearched = lastSearch?.results.includes(toolName) ?? false;

        let signal = DISCOVERY_SIGNAL;
        if (wasSearched) {
          signal = VERY_STRONG_SIGNAL;
        } else if (wasRetrieved) {
          signal = STRONG_SIGNAL;
        }

        retriever
          .recordLearning(context.query, toolName, signal)
          .catch((err) => log.error("Learning signal failed:", err));
      }
    }

    return result;
  });

  return server;
}
