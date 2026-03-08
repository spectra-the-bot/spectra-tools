# CLI Output Contract v1 — Phased Implementation Plan

Status: **Execution plan for implementation phase**  
Design source of truth: [`./cli-output-contract-v1.md`](./cli-output-contract-v1.md)

## Rollout principles

1. **Shared-first**: land reusable adapters in `@spectratools/cli-shared` before package migrations.
2. **Read-first**: migrate read-only packages/commands before mutating flows.
3. **No UX cliffs**: preserve current command names and legacy flags during transition.
4. **Contract tests gate releases**: no package exits a phase without snapshot + exit code coverage.

---

## Package rollout order

1. `@spectratools/cli-shared` (foundation)
2. `@spectratools/etherscan-cli` (read-only, predictable APIs)
3. `@spectratools/xapi-cli` (mixed read/write, heavy cursor pagination)
4. `@spectratools/assembly-cli` (read-only onchain + CTA-rich outputs)
5. `@spectratools/erc8004-cli` (most complex write flows, tx safety)

Rationale: lowest mutation risk first, highest safety-sensitive package last.

---

## Phase 0 — Baseline + scaffolding

Scope:

- Inventory current output behavior per command (`--json`, `--format json`, raw vs wrapped objects).
- Add repo-level `docs/` references and implementation checklist.
- Define contract fixtures (golden files) for success/error/dry-run/pagination.

Deliverables:

- Command inventory matrix (command -> mode -> current output shape -> target shape).
- Test harness helper for capturing stdout/stderr/exit code.

Acceptance criteria:

- Every CLI package has at least one baseline fixture captured from current behavior.
- CI has a place for contract snapshots (can be TODO/skip initially, but wired).

---

## Phase 1 — `@spectratools/cli-shared` foundation

Scope:

- Add shared `CliEnvelopeV1` types.
- Add helpers:
  - `createSuccessEnvelope()`
  - `createErrorEnvelope()`
  - `mapErrorToExitCode()`
  - `normalizeFormatFlag()` (`--json` alias support)
  - `normalizePaginationOptions()` (`--page-all`, `--page-limit`, `--page-delay`)
  - `withDryRun()` preflight wrapper
- Add pagination runtime metrics collector (`pagesFetched`, `itemsReturned`, `nextCursor`).

Deliverables:

- Shared output contract utility module exported from `cli-shared`.
- Unit tests for envelope creation, error serialization, and exit-code mapping.

Acceptance criteria:

- 100% passing tests in `cli-shared` for new helpers.
- Error envelopes always serialize valid JSON and stable required keys.
- Exit mapping deterministic for representative error categories.

---

## Phase 2 — `@spectratools/etherscan-cli`

Scope:

- Adopt shared output adapter for all commands.
- Normalize `--json` and `--format` to contract behavior.
- Map existing `page`/`offset` into pagination metadata where applicable.
- Ensure API errors go to stderr envelope with exit code 3.

Deliverables:

- Contract-compliant outputs for account/contract/token/tx/gas/stats command groups.
- Snapshot tests for success + NOT_FOUND + API failure.

Acceptance criteria:

- All commands emit canonical envelope in `--format json`.
- Error output appears on stderr only.
- Exit codes match taxonomy (0/2/3).
- Legacy examples in README still function.

---

## Phase 3 — `@spectratools/xapi-cli`

Scope:

- Adopt shared adapter + pagination normalization across `collectPaged` call sites.
- Add `--page-all`, `--page-limit`, `--page-delay` support on paginated commands.
- Add `--dry-run` to mutating commands:
  - `posts create`
  - `posts delete`
  - `dm send`
- Respect existing `--verbose` semantics while honoring global `--quiet`/`--verbose` rules.

Deliverables:

- Contract-compliant outputs for read and write command groups.
- Dry-run previews for mutation commands.

Acceptance criteria:

- Dry-run never performs network mutation.
- Paginated commands populate `meta.pagination` consistently.
- `--quiet` + `--verbose` returns usage error (exit 2).

---

## Phase 4 — `@spectratools/assembly-cli`

Scope:

- Adopt shared output adapter for all command groups.
- Normalize CTA structure and metadata presence.
- Ensure table/toon formats remain operator-friendly for governance reads.

Deliverables:

- Full contract compliance for members/council/forum/governance/treasury/status/health.

Acceptance criteria:

- JSON mode emits canonical envelope for every command.
- Human modes remain readable and include CTA unless `--quiet`.
- No command behavior regressions in existing tests.

---

## Phase 5 — `@spectratools/erc8004-cli`

Scope:

- Adopt shared output adapter for all command groups.
- Add `--dry-run` for all mutating commands:
  - `identity register|update|set-wallet`
  - `reputation feedback`
  - `validation request`
- Normalize known errors (`NO_PRIVATE_KEY`, `INVALID_IDENTIFIER`, `INVALID_JOB_HASH`) to stderr envelope + stable exit mapping.
- Add partial-success reporting where applicable (exit 4 + `category=partial`).

Deliverables:

- Contract-compliant read/write behavior with safety previews.
- Extended error fixtures for onchain failures and missing env.

Acceptance criteria:

- All mutation paths have preflight-only dry-run path.
- Existing domain error codes remain stable.
- Tx/RPC failures consistently categorized and mapped to exit code 3.

---

## Cross-package acceptance checklist (release gate)

A package is considered migrated when all are true:

- [ ] `--format json` outputs canonical envelope (`ok/data/meta/error/cta`).
- [ ] `--json` alias works identically.
- [ ] Errors are emitted to stderr envelope (not mixed into stdout).
- [ ] Exit codes follow taxonomy 0/1/2/3/4.
- [ ] `--quiet` and `--verbose` implemented per contract.
- [ ] Paginated commands support/normalize `--page-all --page-limit --page-delay` and emit `meta.pagination`.
- [ ] Mutating commands support `--dry-run` with no side effects.
- [ ] README/docs updated with contract-compliant examples.
- [ ] Snapshot tests cover success + failure + dry-run + paging.

---

## Suggested implementation task breakdown (Codex-ready)

1. Build shared output contract utilities in `cli-shared`.
2. Add a small per-command wrapper API (`runWithContract`) to reduce per-command boilerplate.
3. Migrate one package at a time in rollout order.
4. For each package:
   - update command options wiring,
   - add/refresh tests,
   - update README examples,
   - add changelog migration notes.
5. After all packages migrate, remove transitional warnings/compat toggles in a planned minor/major.

---

## Risks and mitigations

- **Risk:** default output switch breaks existing human workflows.  
  **Mitigation:** staged default policy + docs + alias compatibility window.

- **Risk:** mixed stdout/stderr behavior causes script regressions.  
  **Mitigation:** explicit fixture tests for stream separation.

- **Risk:** dry-run implemented inconsistently across mutation commands.  
  **Mitigation:** shared `withDryRun` utility and mandatory mutation checklist in PR template.
