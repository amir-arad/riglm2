import type { UpstreamTool } from "./types.js";
import type { ToolRegistry } from "./tool-registry.js";
import type { SessionStore } from "./session-store.js";
import { log } from "./log.js";

const DEFAULT_SESSION = "default";

export const META_TOOL_NAMES = [
  "set_context",
  "search_available_tools",
] as const;

export function getMetaToolDefinitions(): UpstreamTool[] {
  return [
    {
      name: "set_context",
      description:
        "Tell the proxy what the user is trying to accomplish. " +
        "Call this early in a conversation to improve tool relevance. " +
        "The proxy uses this context to surface the most relevant tools.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description:
              "What the user is trying to do, in your own words.",
          },
          intent: {
            type: "string",
            description:
              "Optional high-level category (e.g., 'file-management', 'code-review').",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_available_tools",
      description:
        "Search for tools across all connected MCP servers. " +
        "Use this when you need a capability that isn't in your current tool list.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search query to match against tool names and descriptions.",
          },
        },
        required: ["query"],
      },
    },
  ];
}

export function isMetaTool(name: string): boolean {
  return (META_TOOL_NAMES as readonly string[]).includes(name);
}

export function handleMetaTool(
  name: string,
  args: Record<string, unknown>,
  registry: ToolRegistry,
  sessionStore: SessionStore
): { content: Array<{ type: "text"; text: string }> } {
  switch (name) {
    case "set_context":
      return handleSetContext(args, sessionStore);
    case "search_available_tools":
      return handleSearchTools(args, registry);
    default:
      throw new Error(`Unknown meta-tool: ${name}`);
  }
}

function handleSetContext(
  args: Record<string, unknown>,
  sessionStore: SessionStore
) {
  const query = String(args.query ?? "");
  const intent = args.intent ? String(args.intent) : undefined;

  sessionStore.setContext(DEFAULT_SESSION, query, intent);
  log.debug(`Context set: "${query}"${intent ? ` (intent: ${intent})` : ""}`);

  return {
    content: [
      {
        type: "text" as const,
        text: `Context updated. Query: "${query}"${intent ? `, Intent: "${intent}"` : ""}`,
      },
    ],
  };
}

function handleSearchTools(
  args: Record<string, unknown>,
  registry: ToolRegistry
) {
  const query = String(args.query ?? "");
  const results = registry.search(query);

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No tools found matching "${query}". Try a broader search term.`,
        },
      ],
    };
  }

  const lines = results.map(
    (entry) =>
      `- **${entry.namespacedName}**: ${entry.definition.description ?? "(no description)"}`
  );

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${results.length} tool(s) matching "${query}":\n\n${lines.join("\n")}`,
      },
    ],
  };
}
