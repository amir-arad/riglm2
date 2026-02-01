# riglm2 - Product Seed

## Vision

Intelligent tool management and cross-session knowledge sharing for LLM-powered workflows.

## Why MCP

MCP is widely supported—Claude Code, ChatGPT, Cursor, and many others. This enables true plug-and-play: riglm2 can integrate with any MCP-compatible client without requiring changes to user workflows.

## Approach: Spooning MetaMCP

MetaMCP already aggregates MCP servers. Rather than fork or compete, riglm2 extends MetaMCP via its APIs and extension points.

## The Core Challenge

MCP servers are **blind to conversation context**—they only see isolated tool calls. To predict tool relevance and enable cross-session knowledge, riglm2 needs to understand what the user is working on: their intent, the problem domain, the session's scope. Extracting this passively—without requiring the user to tag or describe every session—is the hard problem.

## Core Features

### Tool Use Tracking

Observe which tools are invoked, when, and in what patterns. Capture frequency, sequencing, and outcomes.

### Predictive Tool Relevance

Use tracked patterns to predict which tools matter for a given session:
- Surface relevant tools, hide irrelevant ones
- Reduce context overhead when tool sets are large
- Enable smarter tool presentation without manual configuration

## Future Exploration

### Project Grouping

Group sessions into projects or folders. Shared context within a project; isolation between projects.

### Cross-Session Knowledge

Make knowledge from one session available to others—frictionless, pervasive, automatic. The user shouldn't have to think about it.
