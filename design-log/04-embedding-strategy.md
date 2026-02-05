# 04: Embedding Strategy

## Background

RAG-based tool selection requires embedding both queries and tools into a shared vector space for similarity search.

---

## Problem

1. What content should be embedded for each tool?
2. Which embedding model to use?
3. How to structure the index for fast retrieval?

---

## Questions and Answers

### What content to embed?

| Content | Purpose | Priority |
|---------|---------|----------|
| Tool descriptions | Baseline retrieval | Required |
| Function signatures | Parameter matching | Recommended |
| Usage examples | Sample invocations | Nice-to-have |
| **Query-tool pairs** | **Learned from usage** | **riglm2's differentiator** |

The last item is key—most RAG systems only embed static descriptions. riglm2 learns from actual usage patterns.

### Which embedding model?

**Q**: Local (BGE, E5) or API-based (OpenAI, Voyage)?

**A**: TBD. Trade-offs:

| Approach | Pros | Cons |
|----------|------|------|
| Local (BGE-small) | No API costs, low latency, privacy | Lower quality, local compute |
| Local (E5-large) | Better quality than BGE | More compute, still not SOTA |
| API (text-embedding-3-small) | High quality, no local compute | Cost per query, latency, dependency |
| API (Voyage) | Optimized for code/tools | Higher cost |

**Initial recommendation**: Start with local (BGE-small) for development, benchmark against API for production decision.

### How to structure the index?

Two-tier approach:
1. **Static index**: Tool descriptions, signatures, examples (rebuilt on server config change)
2. **Dynamic index**: Query-tool pairs (updated on each `tools/call`)

```
┌─────────────────────────────────────┐
│          Embedding Index            │
├─────────────────────────────────────┤
│  Static Tier                        │
│  ├─ tool_1_description              │
│  ├─ tool_1_signature                │
│  ├─ tool_2_description              │
│  └─ ...                             │
├─────────────────────────────────────┤
│  Dynamic Tier (learned)             │
│  ├─ "analyze CSV" → pandas_read     │
│  ├─ "send email" → smtp_send        │
│  └─ ...                             │
└─────────────────────────────────────┘
```

---

## Design

### Embedding Pipeline

```typescript
interface ToolEmbedding {
  toolName: string;
  serverName: string;
  vectors: {
    description: number[];
    signature?: number[];
    examples?: number[][];
  };
}

interface LearnedPair {
  query: string;
  queryVector: number[];
  toolName: string;
  confidence: number;  // Based on: was tool actually used after retrieval?
  timestamp: Date;
}
```

### Retrieval Flow

1. Embed incoming query
2. Search static tier for similar tool descriptions
3. Search dynamic tier for similar historical queries
4. Combine results with weighting (e.g., 0.6 static + 0.4 dynamic)
5. Return top-k tools

### Learning Signal

| Event | Signal Type | Weight |
|-------|-------------|--------|
| Tool retrieved AND used | Strong positive | 1.0 |
| Tool retrieved via search AND used | Very strong positive | 1.5 |
| Tool retrieved but NOT used | Weak negative | -0.2 |
| Tool used via `search_available_tools` | Discovery signal | 1.0 + index addition |

---

## Trade-offs

### Static vs Dynamic Weighting
- Too much static weight → doesn't learn
- Too much dynamic weight → overfits to recent usage
- Need experimentation to tune

### Index Size
- More learned pairs = better retrieval but larger index
- May need periodic pruning of low-confidence pairs

---

## Verification Criteria

1. Retrieval precision: >80% of retrieved tools are actually used
2. Learning improves retrieval over time (A/B test)
3. Index query latency <50ms p99
