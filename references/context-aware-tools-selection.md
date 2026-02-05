# RAG-Based Tool Selection for MCP: A Comprehensive Technical Analysis

Context-aware tool filtering represents one of MCP's most pressing unsolved challenges. When MCP servers only receive `tools/call` with arguments—never the user's original query—dynamic tool surfacing becomes architecturally constrained. This report synthesizes existing solutions, emerging patterns, and concrete implementation paths for RAG-based tool selection in the MCP ecosystem.

## The core constraint: MCP's tools/list accepts only pagination

The MCP specification defines `tools/list` with a single parameter: an opaque `cursor` string for pagination. **No mechanism exists for clients to pass query context, filters, or semantic hints** with tool listing requests. Session initialization (`initialize`) handles capability negotiation only—not task or domain context. The reserved `_meta` field exists for protocol-level metadata but lacks standardization for query context.

This architectural constraint means any context-aware selection must happen either client-side (before calling `tools/list`), server-side (with state maintained via other channels), or through proxy interception. The MCP community recognizes this limitation: **SEP-1576** explicitly proposes embedding-based similarity matching where the LLM generates intent and the server returns top-k tools by similarity score—essentially RAG-based tool selection within the protocol itself.

## Claude Code's MCP Tool Search: the only production solution

Among all MCP clients researched,  **Claude Code (CLI) is the only implementation with true context-aware tool filtering** . The system activates automatically when tool descriptions would consume more than 10% of the context window:

* Tools marked with `defer_loading: true` aren't loaded initially into context
* Claude receives a Tool Search meta-tool instead of full definitions
* Queries use either regex patterns (`get_.*_data`) or **BM25 semantic matching**
* Only **3-5 relevant tools (~3K tokens)** load per query versus full context

Results show **85% reduction in token usage** and accuracy improvements from 49% to 74% on MCP evaluations. This implementation lives at the Claude API level with the `defer_loading` flag—other clients (Claude Desktop, Cursor, Cline) load all tools upfront with no dynamic filtering.

Other clients impose hard limits as workarounds: Cursor caps at  **40 tools** , Windsurf at  **50 tools** . Community consensus suggests LLM reliability degrades significantly past ~20 tools, creating real pressure for selection mechanisms.

## What the MCP spec allows without extension

Several patterns work within the current specification. Servers can emit `notifications/tools/list_changed` and dynamically modify available tools based on internal state. Tool annotations (`readOnlyHint`, `destructiveHint`) provide metadata hints. A **meta-tools pattern** exposes a `search_available_tools(query: string)` tool that returns relevant names, then triggers `tools/list_changed` to expose only those tools.

FastMCP's Python SDK already supports tags in tool definitions (though not formally in the spec), and its middleware system provides an `on_list_tools` hook where custom filtering logic can intercept and modify the tool list based on any criteria—including injected context from previous interactions.

## Active community proposals for spec extension

| SEP                | Title                               | Core Mechanism                                                           |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| **SEP-1300** | Tool Filtering with Groups and Tags | Extend `tools/list`with `filter`parameter for groups/tags            |
| **SEP-1284** | Static Metadata Input               | Pass filtering criteria and inference parameters                         |
| **SEP-1576** | Embedding Similarity (Huawei)       | LLM generates intent, server returns top-k by similarity                 |
| **SEP-1978** | Lazy Tool Hydration                 | `minimal`flag returns only names;`tools/get_schema`fetches on-demand |

SEP-1576 from Huawei directly addresses RAG-based selection: servers create weighted embeddings for tools, the LLM generates intent based on user semantics, and the server returns tools with highest similarity scores. SEP-1978's lazy hydration achieved **91% token savings** (54,600 → 4,899 tokens for 106 tools) in testing.

## Proxy and middleware architectures enable context injection

The most viable path for standard client compatibility is proxy-based interception. **igrigorik/MCProxy (Rust)** offers the most advanced middleware system found:

* **ClientMiddleware** : Operates on individual server calls for logging, filtering, payload inspection
* **ProxyMiddleware** : Operates on aggregated tools for description enrichment and tool search
* Built-in tool search that **limits initial list** and provides search functionality to update exposed tools on demand

**FastMCP middleware** provides full programmatic control:

```python
class ContextualFilterMiddleware(Middleware):
    async def on_list_tools(self, context: MiddlewareContext, call_next):
        tools = await call_next(context)
        # Inject semantic filtering logic here
        return filtered_tools
```

**MetaMCP** aggregates multiple servers with namespace-based tool enable/disable and inline metadata editing. Its roadmap mentions "Elasticsearch for MCP tool selection"—suggesting future semantic filtering. **lazy-mcp** takes a hierarchical approach: `get_tools_in_category(path)` lets agents navigate a tree structure, loading servers lazily only when tools are accessed.

| Proxy             | Tool Filtering             | Semantic/Context-Aware | Works with Standard Clients |
| ----------------- | -------------------------- | ---------------------- | --------------------------- |
| igrigorik/MCProxy | Regex + search             | Partial (search tool)  | ✅                          |
| MetaMCP           | Enable/disable + overrides | Roadmap                | ✅                          |
| FastMCP SDK       | Programmable middleware    | Via custom code        | Requires server control     |
| lazy-mcp          | Hierarchical categories    | Category-based         | ✅                          |
| TBXark/mcp-proxy  | Allow/block list           | ❌                     | ✅                          |

## Agent framework patterns translate directly to MCP

**LangChain/LangGraph** documents a canonical RAG-over-tools pattern: embed tool descriptions in a vector store, perform similarity search at query time, then bind only retrieved tools to the LLM. Their implementation uses a `select_tools` node that retrieves relevant tools before the LLM decision step:

```python
def select_tools(state: State):
    query = state["messages"][-1].content
    tool_docs = vector_store.similarity_search(query)
    return {"selected_tools": [doc.id for doc in tool_docs]}
```

**LlamaIndex** provides `ObjectIndex` specifically for indexing arbitrary objects including tools, with `SimpleToolNodeMapping` and retrieval-augmented agents. Their `FnRetrieverOpenAIAgent` takes an object index retriever and selects tools dynamically.

**Microsoft Semantic Kernel** has the most sophisticated built-in implementation called  **Contextual Function Selection** : function descriptions are embedded, conversation context is vectorized, and most relevant functions are retrieved via semantic search. Configuration includes `maxNumberOfFunctions` limits and customizable context embedding providers.

## What to embed for tool retrieval

Research and framework implementations converge on embedding these elements:

* **Tool descriptions** : Natural language functionality descriptions (most common, sufficient for basic retrieval)
* **Function signatures** : Parameter names, types, return values for disambiguation
* **Usage examples** : Sample invocations improve matching for complex tools
* **Category metadata** : Enables hierarchical/filtered retrieval
* **Query-tool pairs** : Learned retrieval from training data (ToolLLM's neural API retriever)

**ToolkenGPT** takes a different approach: each tool becomes a special token ("toolken") with learned embeddings in the LLM vocabulary. When predicted during generation, the model switches to "tool mode"—enabling arbitrary tools without full fine-tuning.

Academic research on embedding models shows instruction-tuned embedders ( **BGE, E5 families** ) perform well for tool descriptions. The **DTDR (Dynamic Tool Dependency Retrieval)** paper demonstrates that conditioning retrieval on both initial query AND execution history outperforms static methods for multi-step tasks.

## Academic foundations: Gorilla, ToolLLM, and RAG-MCP

**Gorilla (Berkeley, NeurIPS 2024)** introduced Retriever-Aware Training (RAT): train models knowing that retrieved documentation may be incorrect. Their APIBench covers 1,600+ APIs with AST-based evaluation for function call correctness. The retrieval pipeline uses BM25 or GPT-Index to fetch API documentation before LLM invocation.

**ToolLLM (OpenBMB, ICLR 2024)** scales to 16,464 real-world RESTful APIs with a neural API retriever that recommends appropriate APIs using embedding-based similarity. Their ToolBench dataset and ToolEval metrics (Pass Rate, Win Rate) have become standard evaluation infrastructure.

**RAG-MCP** directly addresses the MCP ecosystem: storing tool descriptions in external memory and using semantic retrieval reduces prompt tokens by over **50%** while tripling tool selection accuracy (43.13% vs 13.62% baseline). This validates that retrieval-augmented selection significantly outperforms presenting all tools.

Key benchmarks for evaluation include **BFCL (Berkeley Function Calling Leaderboard)** with AST-based and executable evaluation, **ToolBench** with 16K+ APIs, and **ToolRet** which reveals that general retrieval models struggle with tool retrieval tasks—domain-specific retrievers may be necessary.

## Architectural patterns for implementation

**Pattern 1: Proxy-based semantic filtering** (recommended for standard clients)

```
MCP Client → Custom Proxy → [intercept tools/list]
                          → Extract context (from prior interactions, state)
                          → Semantic search over tool embeddings
                          → Return filtered/ranked tools
                          → [intercept tools/call] → route to MCP server
```

**Pattern 2: Meta-tool discovery** (works within current spec)

* Expose minimal initial tool: `search_available_tools(query: string)`
* Server performs embedding search internally
* Returns relevant tool names
* Server emits `tools/list_changed` with expanded tool set
* Limitation: Many clients don't support dynamic tool refresh

**Pattern 3: Hierarchical lazy loading** (lazy-mcp approach)

* Organize tools in category tree
* Expose navigation tools: `get_tools_in_category(path)`
* Agent discovers tools progressively
* Reduces initial context significantly

**Pattern 4: Client-side embedding filter** (requires client modification)

* Client maintains tool embedding index
* Queries filtered before `tools/list` call
* Only request tools matching query semantics

## Tradeoffs between approaches

| Approach            | Standard Client Compatible | Semantic Filtering  | Implementation Effort | Token Savings |
| ------------------- | -------------------------- | ------------------- | --------------------- | ------------- |
| Proxy interception  | ✅                         | ✅ Via custom logic | Medium                | High (85%+)   |
| Meta-tool pattern   | ✅                         | ✅ Server-side      | Low-Medium            | Medium (70%+) |
| Lazy hierarchical   | ✅                         | Category-based only | Low                   | Medium (50%+) |
| Client modification | ❌                         | ✅                  | High                  | High          |
| Wait for SEP-1576   | ✅ (future)                | ✅ Native           | None (wait)           | High          |

The **proxy approach** offers the best balance: works with all standard clients, enables full semantic filtering, and can be deployed incrementally. igrigorik/MCProxy and FastMCP middleware provide solid foundations.

## Recommended implementation path

For immediate deployment without client forks: build a **custom MCP proxy** that intercepts `tools/list`, maintains an embedding index of all downstream tools, and performs semantic filtering based on conversation context extracted from prior `tools/call` invocations or a dedicated `set_context` tool.

The proxy architecture:

1. Aggregate tools from multiple MCP servers (like MetaMCP)
2. Embed tool descriptions + schemas using instruction-tuned embedder
3. Track conversation context via dedicated `set_context(query, intent)` tool
4. Filter `tools/list` responses using top-k similarity search
5. Optionally expose `search_tools(query)` as fallback meta-tool

This approach works with Claude Desktop, Cursor, and other standard clients while providing the semantic filtering benefits demonstrated by academic research. As SEP-1576 or similar proposals mature, the proxy can evolve to pass context natively through the protocol.

## Conclusion

The MCP protocol currently lacks native support for context-aware tool selection—`tools/list` accepts only pagination parameters. However, viable solutions exist through proxy-based interception (igrigorik/MCProxy, FastMCP middleware), meta-tool patterns, and hierarchical loading approaches. Claude Code's MCP Tool Search demonstrates production viability with 85% token reduction. Academic research from Gorilla, ToolLLM, and the RAG-MCP paper validates that retrieval-augmented selection significantly outperforms static tool exposure. For standard client compatibility, a semantic filtering proxy that maintains tool embeddings and tracks conversation context offers the most practical near-term path while the community advances proposals like SEP-1576 toward native protocol support.
