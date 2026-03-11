# RFCs — Request for Comments

This directory contains design proposals for new spectra-tools features.

## RFC Process

1. **Draft** — File a GitHub issue with `type:rfc` + `status:rfc-draft`. Include the RFC body inline in the issue.
2. **Review** — Discuss in the issue. The triage manager will not promote RFCs to the executor queue automatically.
3. **Approved** — If accepted: change label to `status:triaged`, add implementation labels (`priority:*`, `type:feature`). The triage manager will then promote it normally.
4. **Rejected** — Close with `status:wontfix` and a comment explaining why.

## RFC Template

See existing RFCs for format. Required sections:
- **Problem** — What gap does this fill?
- **Proposed Solution** — Commands, API surface, auth model
- **Open Questions** — What needs to be decided before implementation
- **Status** — Current RFC status

## Index

| RFC | Title | Status | Issue |
|-----|-------|--------|-------|
| RFC-001 | DefiLlama CLI | Approved → implemented as epic #357 | #357 |
| RFC-002 | Figma CLI | Draft | #410 |
