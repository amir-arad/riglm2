# Tool Search Deep Dive

[← Back to Index](index.md)

---

## Overview

The Tool Search middleware uses Tantivy (Rust's Lucene equivalent) to provide full-text search across all aggregated tools. This is essential when managing large tool sets.

---

## How It Works

### 1. Index Creation

On startup, all tools are indexed:

```rust
let mut schema_builder = Schema::builder();
let name = schema_builder.add_text_field("name", TEXT | STORED);
let description = schema_builder.add_text_field("description", TEXT | STORED);
let server = schema_builder.add_text_field("server", TEXT | STORED);
let searchable = schema_builder.add_text_field("searchable_text", TEXT);
```

The `searchable_text` field combines name + description for unified search.

### 2. Selective Exposure

If total tools > `maxToolsLimit`:
1. Only expose first N tools (by selection order)
2. Inject `search_available_tools` synthetic tool
3. Hidden tools are searchable but not in tool list

### 3. Search Execution

When `search_available_tools` is called:
1. Parse query with Tantivy's query parser
2. Execute BM25-scored search
3. Filter by `searchThreshold`
4. Replace exposed tools with search results
5. Trigger SSE notification for tool list change

---

## Configuration

```json
{
  "type": "tool_search",
  "enabled": true,
  "config": {
    "maxToolsLimit": 50,
    "searchThreshold": 0.1,
    "toolSelectionOrder": ["server_priority", "alphabetical"]
  }
}
```

### maxToolsLimit

Maximum tools to expose initially.

| Value | Behavior |
|-------|----------|
| 0 | All tools exposed, no search |
| 50 | First 50 tools + search capability |
| 100 | First 100 tools + search if more |

**When total tools ≤ maxToolsLimit**: All tools exposed, no search tool injected.

### searchThreshold

BM25 relevance score cutoff (0.0 - 1.0).

| Value | Behavior |
|-------|----------|
| 0.0 | All matching documents returned |
| 0.1 | Moderate relevance required |
| 0.5 | High relevance required |

Lower values = more results, potentially less relevant.

### toolSelectionOrder

How to select which tools to initially expose:

```json
["server_priority", "alphabetical"]
```

| Strategy | Description |
|----------|-------------|
| `server_priority` | Servers listed first in config get priority |
| `alphabetical` | Tools sorted A-Z by name |
| `random` | Random selection (not recommended) |

Strategies are applied in order. First strategy is primary sort, second is tiebreaker.

---

## The search_available_tools Tool

When tool limit is reached, this tool is injected:

```json
{
  "name": "search_available_tools",
  "description": "Search through 150 additional available tools. Use natural language or keywords to find relevant tools.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query to find relevant tools"
      }
    },
    "required": ["query"]
  }
}
```

### Query Syntax

Tantivy query parser supports:

| Query | Meaning |
|-------|---------|
| `github issue` | Tools matching "github" OR "issue" |
| `github AND issue` | Tools matching both |
| `"create issue"` | Exact phrase match |
| `github*` | Prefix match |
| `name:github` | Field-specific search |
| `description:"pull request"` | Search in description only |

### Example Queries

```
# Find GitHub-related tools
"github"

# Find file operations
"file read write"

# Find tools that create things
"create AND (issue OR file OR document)"

# Search specific server
"server:github"
```

---

## Search Response

When search is executed, the tool returns:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 12 matching tools:\n\n1. github___create_issue - Create a new GitHub issue\n2. github___list_issues - List repository issues\n..."
    }
  ]
}
```

And triggers an SSE event:
```
event: notifications/tools/list_changed
data: {}
```

This signals clients to re-fetch `tools/list`, which now includes search results.

---

## Technical Details

### Index Schema

```rust
struct ToolDocument {
    name: String,        // e.g., "github___create_issue"
    description: String, // Tool description
    server: String,      // e.g., "github"
    searchable_text: String, // Combined: "{name} {description}"
}
```

### Index Storage

- In-memory (RAM directory)
- Rebuilt on server restart
- ~1-5MB per 100 tools

### Search Performance

- Index creation: O(n) where n = total tools
- Search query: O(log n) typical
- Results filtering: O(m) where m = matches

### Index Refresh

Index is rebuilt when:
- Server starts
- Server reconnects
- Tool list changes on any server

---

## Best Practices

### Setting maxToolsLimit

| Scenario | Recommended |
|----------|-------------|
| <50 tools total | 0 (disable) |
| 50-100 tools | 50-75 |
| 100-500 tools | 50-100 |
| 500+ tools | 50 |

### Writing Good Tool Descriptions

For better search results, ensure tool descriptions:
- Include action verbs: "Create", "List", "Get", "Update"
- Mention the domain: "GitHub", "file system", "database"
- Describe the output: "Returns a list of...", "Creates a new..."

### Query Design for Agents

Instruct agents to:
```
When you need a tool that isn't in the current list, use
search_available_tools with descriptive keywords about
what you want to accomplish.
```

---

## Debugging Search

### Enable Search Logging

```json
{
  "type": "tool_search",
  "config": {
    "debug": true
  }
}
```

Outputs:
```
🔍 Tool search query: "github issue"
   Index size: 150 tools
   Matches before threshold: 25
   Matches after threshold: 12
   Search time: 2ms
```

### Test Search Manually

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_available_tools",
      "arguments": {"query": "github"}
    }
  }'
```

---

## Integration with riglm2

For riglm2's use case (100+ MCP tools), tool search provides:

1. **Reduced Initial Payload**: Only 50 tools in first response
2. **Dynamic Discovery**: Agents find tools as needed
3. **LLM Context Savings**: Smaller tool list = more context for conversation
4. **Semantic Access**: Find tools by description, not just name
