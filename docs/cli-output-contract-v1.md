# CLI Output Contract v1 (Incur-aligned)

Status: **Revised after incur behavior validation**  
Scope: All `@spectratools/*-cli` packages

## 1) Purpose

This document defines the output contract we expect across `spectra-tools` CLIs **without re-implementing behavior already provided by [`incur`](https://github.com/wevm/incur)**.

v1 policy is now split into:

1. **Framework contract (inherited from incur)** — required as-is.
2. **Spectra package policy** — conventions we enforce in docs/tests and package command design.

---

## 2) Incur-native runtime contract (required)

These are framework semantics and must be treated as source-of-truth unless we intentionally upgrade/change `incur`.

### 2.1 Global built-ins (do not reimplement)

Every CLI already gets:

- Built-in commands: `completions`, `mcp add`, `skills add`
- Built-in flags: `--format`, `--json`, `--verbose`, `--llms`, `--mcp`, `--schema`, `--filter-output`, `--token-count`, `--token-limit`, `--token-offset`, `--help`, `--version`

### 2.2 Output format defaults

- Default format is **`toon`**.
- `--json` is alias for `--format json`.
- Supported formats are framework-defined (`toon`, `json`, `yaml`, `md`, `jsonl`).

### 2.3 Envelope semantics

In CLI mode:

- `--format json` (or `--json`) **without** `--verbose`:
  - success → `data` only
  - error → `error` object only
- `--format json --verbose`:
  - full envelope (`ok`, `data|error`, `meta`)

Representative verbose JSON shape:

```json
{
  "ok": true,
  "data": { "...": "..." },
  "meta": {
    "command": "registration create",
    "duration": "1ms"
  }
}
```

Notes:

- `meta.cta` may be present when command returns CTA via `c.ok(..., { cta })` / `c.error(..., { cta })`.
- `meta.nextOffset` may be present with token truncation (`--token-limit` + `--verbose`).

### 2.4 Error/exit behavior

- Framework errors serialize through the same output channel selected by format.
- Non-success exits are framework-managed (commonly `1` unless explicitly overridden).
- Domain-specific codes (e.g. `NO_PRIVATE_KEY`, `INVALID_IDENTIFIER`) remain valuable and should stay stable.

### 2.5 Discovery and integration

- `skills add`, `mcp add`, `--llms`, and `--mcp` are built-in and should be documented/used directly.

---

## 3) Spectra package policy (v1)

### 3.1 Machine-consumption profiles

We support two explicit machine profiles:

1. **Data profile (default for scripts):** `--json`
   - parse direct data on success, direct error object on failure.
2. **Envelope profile (for orchestration/telemetry):** `--json --verbose`
   - parse `ok/data/error/meta` envelope.

### 3.2 Human default

- Keep incur default `toon` output for interactive usage.
- Do **not** force a cross-repo default switch to JSON.

### 3.3 Pagination policy

- Use incur token pagination when output-size pagination is needed:
  - `--token-count`, `--token-limit`, `--token-offset`
- Keep command/domain pagination flags (`--limit`, `--max-results`, `--page`, `--offset`, cursor args) command-specific.
- Do **not** introduce new cross-cutting global page flags in v1.

### 3.4 Mutating commands and dry-run

- `--dry-run` is a **package-level feature**, not an incur global.
- Add it only on mutating commands where preview semantics are clear and testable.
- When implemented, docs/tests must prove no side effects occur.

### 3.5 CTA usage

- Prefer incur-native CTA support (`c.ok` / `c.error` metadata) rather than custom top-level CTA envelope shims.

---

## 4) Incur Alignment Notes

1. `table` is **not** an incur global output mode; do not define contract requirements around it.
2. A custom always-on envelope (`ok/data/meta/error`) in non-verbose JSON would fight framework defaults.
3. `skills add`, `mcp add`, and `--llms` are first-class built-ins; do not duplicate them in package code.
4. Global verbosity/quiet policy should not assume flags that incur does not provide globally.

---

## 5) Explicit "do not duplicate framework features"

Do **not** build repo-level abstractions that duplicate or override incur unless there is a versioned product decision to diverge. Specifically, do not add:

- custom global flag parser for built-in incur flags
- custom output envelope wrapper that changes non-verbose JSON semantics
- custom replacements for `skills add`, `mcp add`, or `--llms`
- synthetic global pagination flags when token pagination already exists

If we need behavior beyond incur, document it as an intentional extension with package scope and tests.

---

## 6) Contract examples

### 6.1 Data profile

```bash
erc8004 registration create --name Test --json
```

```json
{
  "name": "Test",
  "erc8004": { "version": "0.1.0" }
}
```

### 6.2 Envelope profile

```bash
erc8004 registration create --name Test --json --verbose
```

```json
{
  "ok": true,
  "data": {
    "name": "Test",
    "erc8004": { "version": "0.1.0" }
  },
  "meta": {
    "command": "registration create",
    "duration": "1ms"
  }
}
```

---

## 7) Backward compatibility impact

This revision **reduces migration risk** versus the earlier draft by aligning with current runtime behavior:

- no forced default-format change to JSON
- no mandatory custom envelope layer
- no immediate global pagination/quiet flag refactor

Primary follow-on work is docs/test alignment plus targeted command-level improvements (dry-run where it matters, stable domain error codes, CTA consistency).
