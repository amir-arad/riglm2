# riglm Code Infrastructure Reference

Reference to reusable code infrastructure from `../riglm/`. All paths relative to riglm root.

## Build & Runtime

### TypeScript Configuration
**File:** `tsconfig.json`

Key settings:
- Target: ES2018, Module: ESNext
- Strict mode with all strict flags enabled
- Bun types (`bun-types`)
- Module resolution: bundler
- Declaration files enabled

### Bun Configuration
**File:** `bunfig.toml`

```toml
[test]
root = "./test"
```

Limits test discovery to `test/` directory (excludes Playwright e2e tests).

### Package.json Scripts
**File:** `package.json`

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target node",
    "build:standalone": "bun build src/index.ts --compile --outfile dist/riglm",
    "start": "bun dist/index.js",
    "test": "bun test",
    "lint": "eslint src",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "deadcode": "knip",
    "circular": "madge --circular --extensions ts src/",
    "deps:check": "depcruise src --config",
    "preversion": "bun run lint && bun run typecheck && bun run deps:check && bun test",
    "version": "git add -A",
    "postversion": "git push && git push --tags",
    "release:patch": "npm version patch",
    "release:minor": "npm version minor",
    "release:major": "npm version major"
  }
}
```

---

## Quality Tooling

### ESLint Configuration
**File:** `eslint.config.js`

Features:
- TypeScript ESLint with project references
- `no-comments` plugin (allows: eslint, jsdoc, @ts-, @type, TODO, WHY)
- Unused vars allowed with `_` prefix
- No console restriction disabled

### Dead Code Detection (Knip)
**File:** `knip.json`

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/index.ts", "!**/*.test.ts", "!**/*.spec.ts"],
  "project": ["src/**/*.ts"],
  "ignore": ["test/**", "e2e-ui/**"],
  "ignoreDependencies": ["bun-types"],
  "ignoreBinaries": ["dot"],
  "ignoreExportsUsedInFile": true
}
```

### Circular Dependency Check
Uses `madge`:
```bash
madge --circular --extensions ts src/
```

### Architecture Enforcement (Dependency Cruiser)
**File:** `.dependency-cruiser.cjs`

Enforces hexagonal architecture layers:
- `domain/` and `ports/` cannot import from `adapters/` or `application/`
- `application/` can import from `ports/` and `domain/`
- `adapters/` can import from `ports/` and `domain/`

---

## CI/CD

### CI Workflow
**File:** `.github/workflows/ci.yml`

Jobs:
1. **test** - typecheck, lint, deadcode, circular, tests
2. **build-check** - verify standalone build works

Triggers: push/PR to main/master

### Release Workflow
**File:** `.github/workflows/release.yml`

Triggers on version tags (`v*`).

Builds standalone executables for:
- linux-x64, linux-arm64
- darwin-x64, darwin-arm64
- windows-x64

Creates GitHub Release with auto-generated notes.

---

## Directory Structure

```
riglm/
├── src/
│   ├── index.ts              # Entry point
│   ├── ports/                # Abstract interfaces
│   ├── domain/               # Pure business logic, Zod schemas
│   ├── adapters/             # Concrete implementations
│   │   ├── http/             # Express routes
│   │   ├── logging/          # Winston adapter
│   │   ├── storage/          # File config adapter
│   │   └── mcp/              # MCP SDK adapters
│   ├── application/          # Services (orchestration)
│   ├── cli/                  # CLI commands, argument parsing
│   │   ├── config/           # Args schema, config resolution
│   │   └── output/           # Banner, help, version, exit codes
│   └── etc/                  # Utilities (closeable, env)
├── test/                     # Bun unit tests
├── e2e-ui/                   # Playwright tests
└── public/                   # Static web UI
```

---

## Reusable Patterns

### CloseablePool (Resource Lifecycle)
**File:** `src/etc/closeable.ts`

Pattern for lazy initialization with automatic cleanup:
```typescript
const pool = createCloseablePool(
  async (key) => { /* create resource */ },
  "ResourceName",
  logger
);
const resource = await pool.get("key");
await pool.close();
```

### CLI Exit Codes
**File:** `src/cli/output/exit-codes.ts`

Standard exit codes for CLI applications.

### CLI Argument Parsing
**File:** `src/cli/parse-args.ts`

Manual argument parsing (no external lib).

**File:** `src/cli/config/args.schema.ts`

Zod schema for CLI arguments.

### Config Resolution
**File:** `src/cli/config/config-locator.ts`

Searches for config in:
1. `./.riglm/config.json5` (project scope)
2. `~/.config/riglm/config.json5` (user scope)

**File:** `src/cli/config/resolved-config.ts`

Merges CLI args with defaults.

### Logger Port
**File:** `src/ports/logger.port.ts`

Abstract logger interface.

**File:** `src/adapters/logging/winston.adapter.ts`

Winston implementation.

---

## Dependencies (Production)

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol (may not need for riglm2) |
| `express` | HTTP server |
| `helmet` | Security headers |
| `json5` | Config parsing |
| `morgan` | HTTP logging |
| `winston` | Logging |
| `zod` | Schema validation |

## Dependencies (Dev)

| Package | Purpose |
|---------|---------|
| `@eslint/js` | ESLint base |
| `@typescript-eslint/*` | TS ESLint |
| `eslint-plugin-no-comments` | Comment linting |
| `dependency-cruiser` | Architecture rules |
| `knip` | Dead code detection |
| `madge` | Circular deps |
| `prettier` | Formatting |
| `@playwright/test` | E2E testing |
| `bun-types` | Bun type defs |
