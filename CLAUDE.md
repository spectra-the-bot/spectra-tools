# CLAUDE.md — Agent Guide for spectra-tools

## Project Overview

**spectra-tools** is a monorepo of agent-friendly CLI tools built on the [incur](https://github.com/wevm/incur) framework by wevm. Each package wraps a specific API or onchain protocol into a structured CLI with TOON output, JSON mode, agent skill discovery (`--llms`, `skills add`, `mcp add`), and CTAs.

Published to npm as `@spectratools/*-cli`.

**Repository:** https://github.com/spectra-the-bot/spectra-tools

## Tech Stack

| Tool | Purpose |
|---|---|
| **incur** (wevm) | CLI framework — TOON output, skills/MCP discovery, CTAs, token pagination |
| **pnpm** | Package manager + workspace protocol |
| **TypeScript** (strict) | Language — `tsconfig.base.json` at root, per-package `tsconfig.json` |
| **biome** | Linter + formatter (replaces ESLint + Prettier) |
| **vitest** | Test runner |
| **tsup** | Build tool — compiles TS → ESM JS for npm publish |
| **changesets** | Version management + npm publish automation |
| **viem** | EVM onchain interactions (assembly-cli, erc8004-cli) |
| **ox** (wevm) | EVM utilities (address checksum, hex ops) — use instead of `@noble/hashes` |

## Directory Structure

```
spectra-tools/
├── packages/
│   ├── assembly/     → @spectratools/assembly-cli (Assembly governance, onchain via viem)
│   ├── erc8004/      → @spectratools/erc8004-cli (ERC-8004 agent identity registry)
│   ├── etherscan/    → @spectratools/etherscan-cli (Etherscan/Abscan block explorer API)
│   ├── xapi/         → @spectratools/xapi-cli (Twitter/X API v2)
│   └── shared/       → @spectratools/cli-shared (auth, retry, rate-limit, pagination middleware)
├── docs/
│   ├── cli-output-contract-v1.md           → Output format standard
│   └── cli-output-contract-implementation-plan.md → Rollout plan
├── .changeset/       → Changesets config
├── .github/workflows/
│   ├── ci.yml        → Build + test + typecheck + lint on PRs
│   └── release.yml   → Changeset-driven npm publish on main push
├── biome.json        → Biome config
├── tsconfig.base.json → Shared TS config
├── vitest.config.ts  → Root vitest config
└── pnpm-workspace.yaml
```

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (shared first, then CLIs)
pnpm build

# Run all tests
pnpm test

# Type check (builds shared first for cross-package resolution)
pnpm typecheck

# Lint (biome check)
pnpm lint

# Format (biome format)
pnpm format

# Add a changeset for version bumping
pnpm changeset
```

## Key Conventions

### Code Style
- **biome** enforces formatting and linting — no eslint/prettier.
- `import { ... } from '@spectratools/cli-shared'` for cross-package imports.
- Use `ox` (`Address.checksum()`, `Hex.*`) for EVM utilities — never `@noble/hashes`.
- Use `viem` for all onchain reads/writes — never raw `fetch` to RPC.

### CLI Architecture (incur)
- Each CLI package exports a `Cli.create(...)` from `incur`.
- Commands use incur's built-in output formatting (TOON default, `--json` for structured).
- `--json --verbose` enables full envelope: `{ ok, data|error, meta }`.
- CTAs suggest logical next commands after output.
- `--llms` auto-generates agent-readable command manifest.
- `skills add` / `mcp add` register CLI commands as agent skills.

### Assembly CLI (onchain)
- All reads via `viem` `readContract` / `multicall` against 5 Assembly contracts.
- Contracts: Registry, CouncilSeats, Forum, Governance, Treasury.
- ABIs stored in `packages/assembly/src/contracts/*.abi.json`.
- Chain: Abstract mainnet (chain ID 2741), multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`.
- RPC configurable via `ABSTRACT_RPC_URL` env, defaults to `https://api.mainnet.abs.xyz`.

### ERC-8004 CLI (onchain)
- Queries ERC-8004 Agent Identity Registry via viem.
- Default registry: `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` on Abstract mainnet.

### Shared Package
- Exports: `createHttpClient`, `withRetry`, `withRateLimit`, `apiKeyAuth`, pagination helpers.
- Runtime exports must resolve to `dist/` (not `src/`) — critical for npm publish.

### PR and Git
- **PR bodies via `--body-file`** — never inline multiline markdown in `--body "..."`.
- Squash merge PRs to main.
- Branch naming: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`.
- **Every PR must include a changeset file** — see Publishing section below.

### Publishing (Changeset-Driven)
- **Every PR that changes package behavior MUST include a changeset file.**
- Create `.changeset/<descriptive-name>.md` with this format:
  ```markdown
  ---
  "@spectratools/<package-name>": patch|minor|major
  ---

  One-line description of what changed.
  ```
- Bump type: `patch` for bug fixes, `minor` for new features/improvements, `major` for breaking changes.
- On merge to main, the release workflow detects the changeset and opens a "Version Packages" PR that bumps versions and updates CHANGELOGs.
- When the Version Packages PR is merged, the workflow publishes to npm automatically.
- **Do NOT run `pnpm changeset version` or `pnpm changeset publish` locally.** Let the CI handle it.
- `NPM_TOKEN` secret required in GitHub Actions.
- All packages published with `--access public` under `@spectratools` scope.

### Testing
- vitest with workspace config.
- Mock viem clients for onchain tests (don't hit real RPC in CI).
- At least one smoke test against real infrastructure for CLI packages before reporting functional.

## Issue Management

GitHub labels are the source of truth for issue state:

| Category | Labels |
|---|---|
| Type | `type:bug`, `type:small-improvement`, `type:feature`, `type:design`, `type:epic` |
| Priority | `priority:high`, `priority:medium`, `priority:low` |
| Status | `status:ready`, `status:in-progress`, `status:triaged`, `status:blocked`, `status:done`, `status:epic-active` |
| Epic | `epic:<N>` (links subtask to parent issue #N) |

- `status:ready` = actionable now, coder can implement immediately.
- `status:triaged` = needs design work or decision before implementation.
- `type:feature` + `status:triaged` = will be decomposed into an epic by Design Unlocker.
- `type:epic` + `status:epic-active` = parent feature, managed automatically. Do not modify.
- `epic:<N>` = subtask of parent issue #N. Triage normally but preserve the label.

### Epic / Feature Flow

Multi-PR features use automated epic decomposition:

1. Create a `type:feature` issue describing the desired feature → triage labels it `status:triaged`
2. Design Unlocker (Opus) decomposes it:
   - Writes architecture comment on parent
   - Relabels parent: `type:epic` + `status:epic-active`
   - Creates up to 5 subtask issues with `epic:<parent>` + `status:ready`
   - Uses priority for sequencing (high = foundational, medium = dependent)
3. Executor picks up subtasks as normal `status:ready` issues
4. PR Reviewer merges subtask PRs and detects when all `epic:<N>` subtasks are closed → auto-closes parent epic

## Output Contract (v1)

See `docs/cli-output-contract-v1.md` for the full spec. Key points:
- Default output: TOON (incur native).
- `--json`: structured data payload.
- `--json --verbose`: full envelope with `ok`, `data|error`, `meta`.
- Exit codes: 0 success, 1 validation, 2 auth, 3 upstream, 4 rate-limit.
- Errors to stderr in structured JSON.
- `--dry-run` for mutating commands.

## Don't

- Don't use `@noble/hashes` — use `ox`.
- Don't use inline `--body` for PR creation — use `--body-file`.
- Don't invent API endpoints that don't exist — verify against real infrastructure.
- Don't ship mock-only tests for external service wrappers — at least one real integration test.
- Don't store internal state files in the repo — state goes in `~/.openclaw/workspace/memory/`.
- Don't reimplement incur built-ins (skills, mcp, --llms, output formatting).
