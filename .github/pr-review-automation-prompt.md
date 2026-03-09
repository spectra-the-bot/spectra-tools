# PR Review Automation Prompt (Merge Guardrails)

Use this checklist before marking a PR merge-ready:

1. Confirm required checks are green and current (no stale success from older commits).
2. Confirm at least one matching changeset exists for behavior/package changes.
3. **Internal dependency graph guardrail:** if the PR touches workspace package versions, cross-package dependencies, lockfile, release plumbing, or npm-invocation e2e paths, verify no package resolves to an unpublished internal version from npm tarballs.
4. If dependency-graph risk exists, require CI evidence that npm-invocation e2e still installs/runs correctly after the change.
5. Block merge when any guardrail fails.

Prompt clause to include verbatim in review automation:

> If this PR changes internal package dependency edges (especially near Version Packages/release prep), check that CI/npm-invocation paths do not reference unpublished internal versions. Fail review if unsafe.
