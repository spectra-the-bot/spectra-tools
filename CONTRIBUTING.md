# Contributing to spectra-tools

Thanks for helping improve `spectra-tools`.

## Local development

```bash
git clone https://github.com/spectra-the-bot/spectra-tools.git
cd spectra-tools
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## Pull request checklist

- [ ] Keep changes scoped to one issue.
- [ ] Add/adjust tests when behavior changes.
- [ ] Add a changeset in `.changeset/*.md`.
- [ ] Ensure `pnpm build`, `pnpm test`, `pnpm typecheck`, and `npx @biomejs/biome check .` pass locally.
- [ ] Use `gh pr create --body-file <file>` (never inline multiline `--body`).

## CI incident lessons (2026-03-09 ETARGET regression)

Main CI failed on commit `c9dd199` because `@spectratools/tx-shared@0.4.0` was missing at install time for npm-invocation e2e. PR #188 fixed this by resolving internal workspace packages via dynamic tarball dependencies in the e2e path.

Guardrails for future PR review (human + automation):

1. Treat changes near release/versioning surfaces (`package.json`, `pnpm-lock.yaml`, workspace packages, npm-invocation e2e) as dependency-graph-sensitive.
2. If a feature PR changes internal package versions or cross-package dependencies, verify install/runtime behavior in npm-invocation tests and confirm the future Version Packages flow will not reference unpublished internal versions.
3. Do not merge while CI checks are stale or incomplete.

## PR review automation prompt guardrail

Automation prompts that review merge readiness must include this explicit check:

> "If this PR changes internal package dependency edges (especially around changesets/release prep), verify that no package will resolve to an unpublished internal version when CI runs from npm tarballs; block merge if the dependency graph is unsafe."

## Branch protection runbook note

`main` must keep branch protection with `strict: true` and required status check `CI` before merge.
