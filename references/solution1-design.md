# riglm2 Solution 1: Tool Context Optimizer

*Extends product-seed.md: Tool Use Tracking + Predictive Tool Relevance*

## Executive Summary

A tool usage tracking and prediction system that wraps MCP servers to optimize context management. By observing tool invocation patterns across sessions, the system predicts which tools are relevant to a given conversation context, reducing cognitive load on LLMs and improving response quality.

**Core Insight**: LLMs perform worse with large tool inventories. By dynamically filtering to contextually-relevant tools, we improve both accuracy and latency.

**The Hard Problem** (from product-seed): MCP servers are blind to conversation context—they only see isolated tool calls. Extracting user intent passively, without requiring explicit tagging, is what makes this challenging.

---

## Problem Statement

### Current State
- MCP clients (Claude Desktop, Cursor, etc.) connect to MCP servers exposing tools
- As tool count grows (50+), LLM performance degrades:
  - Increased token usage for tool descriptions
  - Tool selection confusion
  - Longer response times
  - Higher error rates in tool invocation
- MCP servers receive no conversation context—only `tools/call` with arguments

### Desired State
- Dynamically present only relevant tools per conversation context
- Learn from historical usage patterns to infer context
- Predict tool relevance before explicit invocation
- Zero modification to upstream MCP servers (MetaMCP or others)

---

## Architecture

### Pattern: MCP Proxy Wrapper ("Spoon")

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   MCP Client    │     │   RigLM Tracker     │     │  Upstream MCP   │
│  (Claude, etc.) │────▶│   (Proxy Layer)     │────▶│   (MetaMCP)     │
│                 │◀────│                     │◀────│                 │
└─────────────────┘     └──────────┬──────────┘     └─────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Analytics Store   │
                        │   + Prediction API  │
                        └─────────────────────┘
```

### Design Principles

1. **Non-invasive**: No forking or modification of upstream MCP servers
2. **Transparent**: Clients unaware of interception layer
3. **Stateless proxy**: All state lives in analytics store
4. **Pluggable prediction**: Swap prediction algorithms without protocol changes

---

## Hexagonal Architecture Mapping

*Follows riglm-infra.md patterns*

```
src/
├── ports/                    # Abstract interfaces
│   ├── upstream.port.ts      # MCP client to upstream server
│   ├── downstream.port.ts    # MCP server to clients
│   ├── analytics.port.ts     # Usage data persistence
│   └── predictor.port.ts     # Tool relevance prediction
│
├── domain/                   # Pure business logic, Zod schemas
│   ├── session.ts            # Session entity, lifecycle
│   ├── invocation.ts         # Tool invocation entity
│   ├── prediction.ts         # Prediction result type
│   └── schemas/              # Zod schemas for all entities
│
├── adapters/                 # Concrete implementations
│   ├── mcp/                  # MCP SDK adapters
│   │   ├── upstream-client.adapter.ts
│   │   └── downstream-server.adapter.ts
│   ├── storage/              # Analytics persistence
│   │   ├── sqlite.adapter.ts
│   │   └── postgres.adapter.ts
│   └── prediction/           # Prediction strategies
│       ├── cooccurrence.adapter.ts
│       └── frequency.adapter.ts
│
├── application/              # Orchestration services
│   ├── proxy.service.ts      # Main proxy logic
│   ├── tracking.service.ts   # Async logging
│   └── filtering.service.ts  # Tool list filtering
│
└── cli/                      # Entry point, config
    └── config/
```

---

## Components

### 1. Tracker Proxy (MCP Server)

**Responsibility**: Intercept all MCP protocol messages, log relevant data, optionally filter tool lists.

**Protocol Handlers**:

| Method | Action |
|--------|--------|
| `initialize` | Log session start, extract client metadata |
| `tools/list` | Log available tools, apply prediction filter |
| `tools/call` | Log invocation with full context, forward to upstream |
| `resources/list` | Pass-through with logging |
| `resources/read` | Pass-through with logging |
| `prompts/list` | Pass-through with logging |
| `prompts/get` | Pass-through with logging |

**Configuration** (Zod schema in `domain/schemas/config.schema.ts`):
```yaml
upstream:
  url: "http://metamcp:12008/metamcp/endpoint/sse"
  auth:
    type: "bearer"
    token: "${METAMCP_API_KEY}"

filtering:
  enabled: true
  strategy: "prediction"  # or "allowlist", "denylist", "none"
  min_tools: 5            # Always show at least N tools
  max_tools: 20           # Cap at N tools even if more predicted

logging:
  level: "info"
  include_arguments: true
  include_results: false  # Privacy consideration
```

### 2. Analytics Store (`ports/analytics.port.ts`)

**Responsibility**: Persist usage data, provide query interface for prediction engine.

**Core Entities** (defined in `domain/`):

```
Session
├── id: UUID
├── client_id: string (hashed)
├── started_at: timestamp
├── ended_at: timestamp
├── metadata: jsonb
└── tools_available: string[]

ToolInvocation
├── id: UUID
├── session_id: FK → Session
├── tool_name: string
├── arguments_hash: string
├── timestamp: timestamp
├── duration_ms: int
├── success: boolean
├── sequence_number: int (order within session)
└── context_embedding: vector (optional, future)

ToolCooccurrence (materialized/computed)
├── tool_a: string
├── tool_b: string
├── co_occurrence_count: int
├── avg_sequence_distance: float
└── last_updated: timestamp
```

**Port Interface**:
```typescript
interface AnalyticsPort {
  createSession(session: Session): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  logInvocation(invocation: ToolInvocation): Promise<void>;
  getCooccurrences(tools: string[]): Promise<ToolCooccurrence[]>;
  getToolFrequencies(since: Date): Promise<Map<string, number>>;
}
```

### 3. Prediction Engine (`ports/predictor.port.ts`)

**Responsibility**: Given context signals, return ranked list of relevant tools.

**Input Signals**:

| Signal | Source | Weight |
|--------|--------|--------|
| Previously called tools (this session) | Tracker | High |
| Tool co-occurrence history | Analytics | High |
| Time of day / day of week | System | Low |
| Client identifier patterns | Session | Medium |
| Conversation embeddings | External (optional) | High |

**Prediction Strategies**:

#### Strategy A: Co-occurrence Matrix (Baseline)
```
Given: Tools already used in session = [T1, T2]
Find: Tools frequently co-occurring with T1 or T2
Return: Top-K by co-occurrence score
```
- **Pros**: Simple, interpretable, fast
- **Cons**: Cold start problem, no semantic understanding

#### Strategy B: Sequence Modeling
```
Given: Tool sequence [T1 → T2 → T3]
Predict: P(T_next | sequence)
Model: Markov chain or lightweight transformer
```
- **Pros**: Captures workflow patterns
- **Cons**: Requires more training data

#### Strategy C: Embedding Similarity (Optional Enhancement)
```
Given: Conversation context embedding
Find: Tools with similar description embeddings
Return: Top-K by cosine similarity
```
- **Pros**: Semantic relevance, handles novel contexts
- **Cons**: Requires embedding infrastructure

**Recommended Initial Strategy**: Co-occurrence (A) with fallback to frequency-based ranking. Add sequence modeling (B) once sufficient data exists.

### 4. Control API

**Responsibility**: Configuration, monitoring, manual overrides.

**Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness/readiness |
| `/metrics` | GET | Prometheus metrics |
| `/config` | GET/PUT | Runtime configuration |
| `/predictions/{session_id}` | GET | Current predictions for session |
| `/tools/{tool_name}/stats` | GET | Usage statistics |
| `/sessions` | GET | Active sessions |
| `/override` | POST | Manual tool inclusion/exclusion |

---

## Data Flow

### Session Lifecycle

```
1. Client connects → Tracker creates Session record
2. Client requests tools/list →
   a. Tracker fetches from upstream
   b. Logs available tools
   c. Queries Prediction Engine
   d. Filters tool list
   e. Returns filtered list to client
3. Client calls tool →
   a. Tracker logs invocation (async)
   b. Forwards to upstream
   c. Returns result to client
   d. Updates prediction model (async)
4. Client disconnects → Tracker closes Session record
```

### Prediction Update Loop

```
Async Worker (periodic):
1. Aggregate recent ToolInvocations
2. Rebuild ToolCooccurrence materialized view
3. Retrain sequence model (if applicable)
4. Invalidate prediction caches
```

---

## Integration Points

### With MetaMCP

- **Upstream connection**: SSE or Streamable HTTP transport
- **Authentication**: Bearer token (API key)
- **Optional**: Use MetaMCP tRPC API for dynamic tool enable/disable at namespace level (alternative to proxy filtering)

### With MCP Clients

- **Downstream connection**: Expose same transports as upstream (SSE, HTTP, stdio via wrapper)
- **Zero configuration**: Clients point to Tracker instead of upstream; no client changes required

### With Observability Stack

- **Metrics**: Prometheus exposition format
- **Logs**: Structured JSON, compatible with standard collectors
- **Traces**: OpenTelemetry spans (optional)

---

## Privacy & Security Considerations

| Concern | Mitigation |
|---------|------------|
| Tool arguments may contain secrets | Hash or omit arguments in logs; configurable |
| Tool results may contain PII | Don't log results by default |
| Session correlation | Hash client identifiers |
| Data retention | Configurable TTL, automatic purge |

---

## Scalability Considerations

### Single-instance (Initial)
- SQLite or PostgreSQL for analytics
- In-memory prediction cache
- Suitable for: <100 concurrent sessions, <1000 tools

### Multi-instance (Future)
- Shared PostgreSQL or ClickHouse
- Redis for session state and prediction cache
- Horizontal scaling of Tracker Proxy
- Suitable for: Multi-tenant, high-throughput deployments

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool list reduction | >50% fewer tools shown | `filtered_count / total_count` |
| Prediction accuracy | >80% of used tools were predicted | `predicted_and_used / total_used` |
| Latency overhead | <50ms added to tools/list | P99 latency delta |
| Cold start handling | Graceful degradation | Fallback to frequency-based |

---

## Open Questions

1. **Embedding source**: Use tool descriptions only, or incorporate conversation context from client?
2. **Cross-user learning**: Share patterns across users, or isolate per-user/per-tenant?
3. **Feedback loop**: Should users be able to explicitly mark tool relevance?
4. **Multi-upstream**: Support proxying to multiple MCP servers with unified prediction?

---

## Non-Goals (For This Design)

- Forking or modifying MetaMCP source
- Infrastructure choices (see `riglm-infra.md` for: Bun, TypeScript, ESLint, CI/CD)
- Production hardening (rate limiting, auth, multi-tenancy)
- UI/Dashboard (analytics visualization)
- Cross-session knowledge sharing (future exploration per product-seed.md)
- Project grouping (future exploration per product-seed.md)

---

## Relationship to Product Roadmap

| Product Feature | This Design | Future |
|-----------------|-------------|--------|
| Tool Use Tracking | **Core focus** | - |
| Predictive Tool Relevance | **Core focus** | - |
| Project Grouping | - | Session clustering based on tool patterns |
| Cross-Session Knowledge | - | Requires conversation context injection |

---

## Implementation Sequence

1. **Phase 1: Transparent Proxy** - Pass-through with session/invocation logging
2. **Phase 2: Analytics** - Persistence, co-occurrence computation
3. **Phase 3: Prediction** - Frequency-based → co-occurrence-based filtering
4. **Phase 4: Tuning** - Min/max thresholds, accuracy measurement
5. **Phase 5: Context Signals** - Explore additional signals for prediction improvement

---

*Document Version: 1.0*
*Status: Draft*
*Last Updated: 2026-02-01*
*References: product-seed.md, riglm-infra.md*
