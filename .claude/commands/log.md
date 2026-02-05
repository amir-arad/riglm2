---
description: Capture design decisions from the current conversation into a new design log entry
---

Extract design-relevant information from the current conversation and write a new design log entry.

Optional topic hint: `$ARGUMENTS`

## Procedure

### 1. Determine next entry number

Read `design-log/index.md`. Find the highest existing entry number N. New entry is N+1.

### 2. Extract from conversation

Scan the full conversation for:

- **Background**: What prompted this discussion? What phase/feature?
- **Problem**: The specific problem being solved.
- **Questions and Answers**: Decisions made, what was considered, what was chosen, rationale.
- **Design**: Components created/modified, data flows, interfaces.
- **Trade-offs**: Pros/cons. Alternatives rejected and why.
- **Verification Criteria**: How to confirm correctness.

Use `$ARGUMENTS` as the title if provided. Otherwise infer a concise title.

### 3. Write the entry

Create `design-log/{NN}-{slug}.md`:

```markdown
# {NN}: {Title}

## Background

{1-2 paragraphs}

---

## Problem

{1-2 sentences}

---

## Questions and Answers

### Q1: {Question}

**Decision**: {What was decided}

**Why**: {Rationale}

---

## Design

{Components, data flows, interfaces}

---

## Trade-offs

### {Decision name}
- **Pro**: ...
- **Con**: ...
- **Mitigation**: ...

---

## Verification Criteria

| Criterion | Status |
|-----------|--------|
| {check} | Pending |
```

### 4. Update the index

Read `design-log/index.md`. Append the new entry row to the table. Preserve existing rows exactly.

### 5. Confirm

Report the file path and a one-line summary of what was captured.

## Rules

- Omit sections with no conversation content (skip empty Trade-offs, etc.)
- Keep descriptions factual — capture what was decided, not editorial commentary
- Use code blocks, tables, diagrams from the conversation verbatim where relevant
- Slug: lowercase-kebab-case from title
- Do NOT fabricate decisions not present in the conversation
