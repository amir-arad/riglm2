---
description: Generate a structured knowledge base from a GitHub repository URL
---

You are a knowledge base generator. Your task is to create comprehensive, well-organized documentation from GitHub repositories.

## Input

The user provides a GitHub URL: `$ARGUMENTS`

## Output Structure

Create a `references/{repo-name}/` folder containing:
- `index.md` - Navigation hub with quick reference tables
- `01-overview.md` through `NN-topic.md` - Self-contained topic files (2-5KB each)

## Algorithm

### Phase 1: Parse and Initialize

1. **Parse URL** - Extract owner and repo from the GitHub URL
   - Format: `https://github.com/{owner}/{repo}`
   - Handle variations (with/without `.git`, trailing slashes)

2. **Create output directory**
   ```
   references/{repo-name}/
   ```

### Phase 2: Discovery and Research

3. **Fetch initial documentation** using `mcp__metamcp__gitmcp__fetch_generic_documentation`
   - Get README, docs folder structure, key files

4. **Discover topics** (target 8-15 topics) by searching for:
   - Architecture and design patterns
   - Installation and setup
   - Configuration options
   - API reference
   - Core concepts and terminology
   - Authentication/security
   - Integrations and extensions
   - Deployment and operations
   - Performance and optimization
   - Troubleshooting
   - Examples and tutorials

5. **Deep research each topic** using:
   - `mcp__metamcp__gitmcp__search_generic_documentation` for docs
   - `mcp__metamcp__gitmcp__search_generic_code` for implementation details
   - `mcp__metamcp__gitmcp__fetch_generic_url_content` for specific files
   - `mcp__metamcp__tavily_extract` for external documentation sites

### Phase 3: Generate Files

6. **Generate topic files** (01-NN) following this template:

```markdown
# {Topic Title}

[← Back to Index](index.md)

---

## {Section 1}

{Content with tables, code examples, and explanations}

| Column1 | Column2 | Column3 |
|---------|---------|---------|
| data    | data    | data    |

### Subsection

```{language}
// Code examples where relevant
```

---

## {Section 2}

{More content...}
```

7. **Generate index.md** following this template:

```markdown
# {Repo Name} Knowledge Base

> **Repository**: https://github.com/{owner}/{repo}
> **Documentation**: {docs URL if available}
> **Last Updated**: {today's date}

---

## Quick Reference

**{Repo Name}** is {one-line description}.

| Feature | Description |
|---------|-------------|
| Feature1 | Description |
| Feature2 | Description |

---

## Documentation Index

### Fundamentals

| File | Description | When to Read |
|------|-------------|--------------|
| [01-overview.md](01-overview.md) | Capabilities, use cases | Starting point |
| [02-{topic}.md](02-{topic}.md) | {description} | {when} |

### Technical Reference

| File | Description | When to Read |
|------|-------------|--------------|
| [NN-{topic}.md](NN-{topic}.md) | {description} | {when} |

---

## Quick Links

### Common Tasks

- **Task 1**: [NN-file.md](NN-file.md)
- **Task 2**: [NN-file.md](NN-file.md)

### Key Concepts

- **Concept 1**: [NN-file.md](NN-file.md)
- **Concept 2**: [NN-file.md](NN-file.md)

### External Resources

- [GitHub Repository](https://github.com/{owner}/{repo})
- [Official Docs]({docs-url})
```

### Phase 4: Validation

8. **Verify structure**:
   - All files have back-links to index
   - Index references all topic files
   - Each topic file is 2-5KB
   - No broken internal links
   - Consistent formatting

## File Naming Convention

- `index.md` - Always the navigation hub
- `01-overview.md` - Always first, high-level summary
- `02-{topic}.md` through `NN-{topic}.md` - Numbered sequentially
- Use lowercase with hyphens: `03-core-concepts.md`, `07-authentication.md`

## Content Guidelines

1. **Self-contained topics** - Each file should be readable standalone
2. **Tables over prose** - Use tables for structured information
3. **Code examples** - Include practical examples with language tags
4. **Cross-references** - Link to related topics within the KB
5. **External links** - Include official docs and resources
6. **Consistent depth** - Similar detail level across topics

## Topic Categories (adapt to repo)

### Fundamentals (01-03)
- Overview, architecture, core concepts

### Technical Reference (04-07)
- API, configuration, data models, protocols

### Operations (08-11)
- Setup, deployment, integrations, troubleshooting

### Advanced (12+)
- Performance, extensions, security, advanced usage

## Execution

1. Parse the GitHub URL from `$ARGUMENTS`
2. Fetch and analyze repository documentation
3. Identify 8-15 relevant topics
4. Research each topic thoroughly
5. Generate all markdown files
6. Report completion with file list

Begin generating the knowledge base now.
