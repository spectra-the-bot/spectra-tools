# CLI Output Contract v1

Status: **Proposed (design-approved target)**  
Scope: All `@spectratools/*-cli` packages

## 1) Why this exists

`spectra-tools` currently mixes output conventions (`--json`, `--format json`, raw object output vs wrapped envelopes, mixed paging flags). This contract standardizes behavior across packages while preserving command ergonomics.

The design follows common market patterns:

- **OpenSea-style operator UX**: readable human output with actionable next-step commands.
- **Google Workspace/gcloud-style automation UX**: strict machine-readable JSON and consistent stderr errors + exit codes.

## 2) v1 goals

- One canonical envelope for **success and failure**.
- One consistent format flag with 3 modes: `json` (default), `toon`, `table`.
- Unified pagination controls: `--page-all`, `--page-limit`, `--page-delay`.
- Safe mutation preview via `--dry-run`.
- Standard verbosity controls: `--quiet`, `--verbose`.
- Deterministic stderr error schema and exit codes (`0..4`).
- Backward-compatible rollout path from current package behavior.

Non-goals (v1):

- Large command tree renames.
- Mandatory refactor of business logic.
- Contract-level transport changes (still plain CLI stdio).

---

## 3) Canonical output envelope

All commands MUST produce the following top-level shape in `json` mode.

```ts
interface CliEnvelopeV1<T = unknown> {
  ok: boolean;
  data?: T;                // present when ok=true
  meta: {
    cli: string;           // e.g. "xapi"
    version?: string;      // package version if available
    command: string;       // resolved command path, e.g. "posts search"
    timestamp: string;     // ISO8601
    durationMs?: number;
    requestId?: string;    // optional trace id

    format: 'json' | 'toon' | 'table';
    quiet?: boolean;
    verbose?: boolean;

    pagination?: {
      enabled: boolean;
      mode?: 'cursor' | 'offset';
      pageAll?: boolean;
      pageLimit?: number;
      pageDelayMs?: number;
      pagesFetched?: number;
      itemsReturned?: number;
      nextCursor?: string | null;
      hasMore?: boolean;
    };

    dryRun?: {
      enabled: boolean;
      mutable: boolean;
      wouldMutate?: boolean;
    };

    warnings?: string[];
  };

  error?: {
    code: string;          // stable machine code
    message: string;       // human-readable summary
    category: 'usage' | 'auth' | 'network' | 'upstream' | 'internal' | 'partial';
    retryable: boolean;
    details?: unknown;
    hint?: string;
    docsUrl?: string;
  };

  cta?: {
    description?: string;
    commands?: Array<{
      command: string;
      args?: Record<string, unknown>;
      options?: Record<string, unknown>;
      description?: string;
    }>;
  };
}
```

### Required field behavior

- `ok=true`: `data` MUST be present, `error` MUST be omitted.
- `ok=false`: `error` MUST be present, `data` MAY be omitted.
- `meta` MUST always be present.
- `cta` is optional and SHOULD be provided for discoverability when useful.

### Success example

```json
{
  "ok": true,
  "data": {
    "posts": [{ "id": "1900", "text": "hello" }],
    "count": 1
  },
  "meta": {
    "cli": "xapi",
    "command": "posts search",
    "timestamp": "2026-03-08T02:10:00.000Z",
    "format": "json",
    "pagination": {
      "enabled": true,
      "mode": "cursor",
      "pageAll": false,
      "pageLimit": 10,
      "pageDelayMs": 250,
      "pagesFetched": 1,
      "itemsReturned": 1,
      "hasMore": true,
      "nextCursor": "abc123"
    }
  },
  "cta": {
    "description": "Next steps",
    "commands": [{ "command": "posts get", "args": { "id": "1900" } }]
  }
}
```

---

## 4) Format modes

### Flags

- Primary: `--format <json|toon|table>`
- Alias (compat): `--json` == `--format json`

### Modes

1. `json` (**default**): canonical envelope to stdout.
2. `toon`: compact, expressive human layout (emoji/symbol callouts, key facts, next actions).
3. `table`: tabular human layout for list-heavy data; falls back to key-value blocks for single objects.

### Default behavior

- Contract default is `json`.
- During migration, packages MAY preserve TTY-friendly defaults (`toon`) if no `--format` is supplied, but MUST:
  - keep `json` as canonical internal shape,
  - emit a deprecation warning in `meta.warnings` (and human notice in non-quiet mode),
  - document the package-specific cutoff release where strict `json` default becomes active.

This preserves existing UX while converging to one standard.

---

## 5) Pagination contract

Applies to commands that can fetch multiple pages.

### New standard flags

- `--page-all` (boolean): fetch all pages until source exhaustion.
- `--page-limit <n>` (number): max total items to emit across pages.
- `--page-delay <ms>` (number): delay between page fetches (default package-defined, recommended `200-500ms`).

### Rules

- If `--page-all` is true, continue paging until no `nextCursor` / no more offset pages.
- If both `--page-all` and `--page-limit` are set, `page-limit` is a hard cap.
- Without `--page-all`, command behavior remains single-page unless command already paged by default.
- `meta.pagination` MUST be populated whenever paging codepath runs.

### Legacy option mapping

To avoid breaking existing commands:

- Keep existing flags (`--max-results`, `--limit`, `--page`, `--offset`) as aliases/inputs.
- Normalize internally:
  - `--max-results` / `--limit` => `pageLimit`
  - `--page` + `--offset` => offset mode seed values
- Emit deprecation notes in docs first, then runtime warnings in a later minor.

---

## 6) Mutating-command safety: `--dry-run`

All mutating commands MUST support `--dry-run`.

Mutating examples in current repo include:

- `xapi posts create|delete`
- `xapi dm send`
- `erc8004 identity register|update|set-wallet`
- `erc8004 reputation feedback`
- `erc8004 validation request`

### Dry-run behavior

When `--dry-run` is provided:

- Validate args/env/auth preconditions.
- Build/preview request/tx intent.
- DO NOT call mutating upstream endpoints or send transactions.
- Return `ok=true` with `meta.dryRun.enabled=true` and `meta.dryRun.wouldMutate=true`.
- Include actionable `cta` for executing the real command.

Example dry-run data snippet:

```json
{
  "ok": true,
  "data": {
    "operation": "xapi.posts.create",
    "preview": { "text": "Hello world" }
  },
  "meta": {
    "dryRun": { "enabled": true, "mutable": true, "wouldMutate": true }
  }
}
```

---

## 7) Verbosity controls

Global flags:

- `--quiet`: suppress non-essential narration/cta in human modes; in `json`, keep envelope minimal (still include required fields).
- `--verbose`: include extended diagnostics/fields (without changing required schema).

Rules:

- `--quiet` and `--verbose` together => usage error (`exit 2`).
- In `json` mode:
  - `--verbose` SHOULD add `meta.warnings`, debug counts, and optional raw excerpts in `meta` (not arbitrary top-level fields).
  - `--quiet` SHOULD still preserve `ok/data/meta/error` contract.

---

## 8) stderr error schema + exit codes

Errors MUST be written to `stderr` as JSON envelope (single object line).  
`stdout` should be reserved for success payloads and non-error human output.

### Error object (inside envelope)

```json
{
  "ok": false,
  "meta": {
    "cli": "erc8004",
    "command": "validation request",
    "timestamp": "2026-03-08T02:22:11.000Z",
    "format": "json"
  },
  "error": {
    "code": "NO_PRIVATE_KEY",
    "message": "PRIVATE_KEY environment variable is required for write operations.",
    "category": "auth",
    "retryable": false,
    "hint": "Set PRIVATE_KEY or run with --dry-run."
  }
}
```

### Exit code taxonomy (v1)

- `0` = Success (including dry-run success)
- `1` = Internal/unhandled CLI error
- `2` = Usage/validation error (bad args/options/schema/conflicting flags)
- `3` = Upstream/service/runtime dependency error (network timeout, 429/5xx, RPC/API failure)
- `4` = Partial/action-required outcome (partial page fetch, degraded success, or explicit operator intervention required)

Notes:

- Retryability is driven by `error.retryable`, not only exit code.
- `code` strings (e.g. `NO_PRIVATE_KEY`, `INVALID_IDENTIFIER`) must stay stable across minor releases.

---

## 9) Backward compatibility + migration notes

### Compatibility policy

- No command-path renames required in v1.
- Existing flags remain accepted initially (`--json`, existing pagination flags).
- Existing response fields can stay inside `data`; only envelope consistency is mandated.

### Breaking changes to call out explicitly

Potentially breaking for scripts/humans:

1. **Default output becomes json** (after migration cutoff per package).
2. Errors normalize to stderr envelope (instead of mixed stdout error objects).
3. Mutating commands gain `--dry-run` (additive), and may later adopt stricter preflight checks.

### Migration strategy

- Phase-in via shared adapter layer in `@spectratools/cli-shared`.
- Adopt package-by-package with fixture snapshots for:
  - success envelopes,
  - stderr error envelopes,
  - exit codes,
  - dry-run behavior,
  - pagination metadata.
- Keep legacy aliases until at least one stable minor after full rollout.

---

## 10) Implementation guardrails for Codex phase

- Centralize envelope creation + error mapping in shared package (single source of truth).
- Add command metadata flag (`mutable: true`) to auto-inject dry-run handling.
- Introduce shared pagination adapter to wrap cursor/offset implementations and populate `meta.pagination`.
- Add repository-wide golden tests for cross-package output contract compliance.
- Do not rewrite business logic until adapters and tests are in place.
