# Adaptive Tool Selection for MCP

## Problem Statement

MCP's architecture requires clients to configure each server connection separately. A power user with tools spread across multiple servers faces two bad options:

1. **Configure per-use-case** : Maintain multiple endpoint configurations with manually curated tool sets. Doesn't adapt; just shifts management burden.
2. **Aggregate everything** : One endpoint exposing all tools. Context bloat makes this non-viable — Claude's context window fills with tool definitions, cost increases, and model performance degrades with hundreds of irrelevant tools.

The actual need:  **surface relevant tools for the current query without manual curation** .

## Solution Approach

A transparent proxy that learns tool relevance from usage patterns.

```
User query 
    → Embed query 
    → Find historically similar contexts 
    → Retrieve tools that were used in those contexts 
    → Inject into Claude's context 
    → Observe what Claude actually uses 
    → Update relevance model
```

This is a recommendation system, not keyword matching on tool descriptions.

## Core Mechanisms

### Aggregation Layer

Single MCP endpoint that proxies to multiple upstream MCP servers. Client connects once; proxy manages server connections, credentials, and tool namespacing.

### Relevance Model

For each tool, maintain associations between **context embeddings** and  **usage outcomes** .

What gets embedded:

* The user message that triggered a tool call
* The tool's input arguments (the semantic link between intent and action)

Not: arbitrary N-turn windows. The trigger message is the signal; prior context is noise.

### Cold Start Strategy

Start permissive, tighten as confidence rises.

* Initially: surface all tools
* As usage data accumulates: stop surfacing tools in contexts where they've proven irrelevant
* Relevance is  **per-context** , not per-tool. A currency converter has high relevance for "convert USD to EUR" and zero relevance for "write a regex."

### Recovery Mechanism

Always inject a meta-tool: `search_available_tools(query: string)`

When Claude uses this:

* It signals retrieval missed something
* The search query + resulting tool call is strong positive signal for that context
* The tools that *were* retrieved but bypassed get weak negative signal

Optional: `enable_tool_group(group: string)` to let Claude request categories without knowing specific tool names.
