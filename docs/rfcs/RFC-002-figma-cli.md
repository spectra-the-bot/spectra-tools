# RFC-002: Figma CLI (`@spectratools/figma-cli`)

**Status:** Draft  
**Issue:** #410  
**Created:** 2026-03-10

## Problem

Agent workflows that interact with design artifacts have no programmatic access to Figma files. Currently, design assets must be manually exported or referenced by URL. This creates a gap when an agent needs to:

- Read design tokens (colors, typography, spacing) from a live Figma file
- Export specific frames or components as SVGs/PNGs for reference
- List components in a design system to understand what exists
- Post or read comments on design artifacts

## Proposed Solution

A new `@spectratools/figma-cli` package following the same incur + tsup + strict TypeScript pattern as existing CLI packages.

**Authentication:** Figma personal access token via `FIGMA_API_KEY` env var.

**Proposed commands:**

```
figma files get <file-key>
figma files list --project-id <id>
figma nodes get <file-key> <node-id>
figma tokens export <file-key>
figma frames export <file-key> [--ids ...] [--format png|svg] [--scale 1]
figma components list <file-key>
figma components get <file-key> <key>
figma comments list <file-key>
figma comments post <file-key> --message <text> [--node-id <id>]
```

**API:** Figma REST API v1 (stable). Read-only except comments.

**Token export format:** W3C Design Token Community Group format for interoperability with downstream tools.

## Open Questions

1. W3C DTCG token format vs flat key/value vs custom?
2. Frame export rate limits — need retry + streaming download strategy
3. Binary name: `figma` vs `figma-cli` (check npm conflicts)

## Status

Draft — awaiting approval before queuing for implementation.

## References

- [Figma REST API](https://www.figma.com/developers/api)
- Related: `@spectratools/graphic-designer-cli`
