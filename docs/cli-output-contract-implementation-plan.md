# CLI Output Contract v1 — Implementation Plan (Incur-aligned)

Status: **Execution plan for follow-on implementation**  
Design source of truth: [`./cli-output-contract-v1.md`](./cli-output-contract-v1.md)

## Rollout principles

1. **Framework-first:** adopt incur behavior as-is before adding package-specific layers.
2. **Low-risk migration:** prefer docs/tests/wrappers over broad command rewrites.
3. **Two explicit machine profiles:** `--json` (data) and `--json --verbose` (envelope).
4. **No duplicate runtime features:** do not rebuild built-in flags/commands/envelope semantics.

---

## Incur Alignment Notes

- `skills add`, `mcp add`, `--llms`, `--schema`, token pagination flags, and envelope behavior are already implemented by incur.
- Default format is `toon`; changing repo-wide defaults would be an intentional product decision, not part of this migration.
- Non-verbose `--json` is data/error-only by design. Full envelope is `--verbose`.

---

## Phase 0 — Baseline verification (docs + fixtures)

Scope:

- Capture current behavior from each package for:
  - default output (`toon`)
  - `--json`
  - `--json --verbose`
  - representative errors
- Record in test fixtures/snapshots.

Deliverables:

- Output matrix per package/command.
- Shared test helper for stdout + exit-code capture (and stderr when applicable).

Acceptance criteria:

- At least one command per package has snapshots for all three output modes.
- Error snapshots confirm domain error codes where already implemented.

---

## Phase 1 — Contract/test harness alignment (`@spectratools/cli-shared`)

Scope:

- Add lightweight test utilities (not runtime envelope wrappers):
  - `runCliJsonData(...)`
  - `runCliJsonEnvelope(...)`
  - `expectIncurVerboseEnvelope(...)`
- Add docs-facing types for expected verbose envelope shape used in tests.

Deliverables:

- Reusable test helpers in shared package.
- Unit tests for helper behavior.

Acceptance criteria:

- No new framework-like output adapters introduced.
- Helpers reflect actual incur semantics (data-only vs verbose envelope).

---

## Phase 2 — Package-by-package docs/test updates

Rollout order:

1. `@spectratools/etherscan-cli`
2. `@spectratools/xapi-cli`
3. `@spectratools/assembly-cli`
4. `@spectratools/erc8004-cli`

Scope per package:

- Update tests to assert both machine profiles where appropriate:
  - `--json`
  - `--json --verbose`
- Normalize README examples to avoid implying a custom envelope in plain `--json` mode.
- Confirm help/docs mention incur built-ins where relevant (`skills add`, `mcp add`, `--llms`).

Acceptance criteria:

- README examples match real command behavior.
- Tests no longer assume non-verbose JSON contains `ok` envelope fields.

---

## Phase 3 — Targeted command-level policy improvements (optional, scoped)

Scope:

- Add/expand `--dry-run` only for high-risk mutating commands where semantics are clear.
- Standardize domain error code usage (`NO_PRIVATE_KEY`, `INVALID_IDENTIFIER`, etc.).
- Add CTA hints on key flows using incur-native `c.ok`/`c.error` metadata.

Acceptance criteria:

- Each dry-run command has explicit no-side-effect tests.
- Domain error codes remain stable in snapshots.
- CTA appears in verbose envelope metadata when returned.

---

## Cross-package acceptance checklist

- [ ] `--json` outputs data/error payloads matching incur defaults.
- [ ] `--json --verbose` outputs envelope with `ok` + `meta.command` (+ `meta.duration`).
- [ ] Built-in commands/flags are documented accurately (no custom duplicates).
- [ ] README examples are aligned with real CLI behavior.
- [ ] Domain error codes remain stable.
- [ ] Any added `--dry-run` behavior is command-scoped and side-effect tested.

---

## Explicit "do not build" list

Do **not** implement these in this migration:

1. A custom global output envelope layer that overrides incur non-verbose semantics.
2. A custom global flag system for flags incur already provides.
3. A synthetic global pagination flag suite (`--page-all`, `--page-limit`, `--page-delay`) at framework level.
4. A repo-wide forced switch from `toon` default to `json`.
5. Custom reimplementation of `skills add` / `mcp add` / `--llms` behavior.

---

## Suggested Codex task breakdown

1. Add shared test helpers (Phase 1).
2. Migrate package tests/readmes in rollout order (Phase 2).
3. Land optional dry-run/error/CTA improvements as separate small PRs (Phase 3).
4. Keep each PR narrow (docs/tests first, behavior changes separately).

This sequencing keeps migration realistic, auditable, and low-risk while staying tightly aligned with incur runtime semantics.
