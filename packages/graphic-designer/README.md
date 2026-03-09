# @spectratools/graphic-designer

Deterministic infographic rendering pipeline for agent workflows.

This package provides a production render path (no browser/screenshot dependency), hard QA checks, and publish adapters for Gist/GitHub.

## Why this package exists

Browser screenshot pipelines were introducing instability (viewport drift, clipping, black bars, brittle local dependencies). `@spectratools/graphic-designer` replaces that with:

- **single canonical render entrypoint** (`renderDesign`)
- **deterministic PNG output** for same `DesignSpec + generatorVersion`
- **hard QA gate** before publish
- **bounded retry/backoff** in publish adapters

## Install

```bash
pnpm add @spectratools/graphic-designer
# or global CLI
pnpm add -g @spectratools/graphic-designer
```

## CLI

```bash
design render --template gtm-pipeline --data ./data/pipeline.json --out ./output
design qa --in ./output/gtm-pipeline-g0.1.0-sabc123.png --spec ./output/gtm-pipeline-g0.1.0-sabc123.spec.json
design publish --in ./output/gtm-pipeline-g0.1.0-sabc123.png --target gist
design publish --in ./output/gtm-pipeline-g0.1.0-sabc123.png --target github --repo owner/repo --branch main
```

### Render outputs

`design render` writes three files:

1. `*.png` (artifact)
2. `*.meta.json` (sidecar metadata)
3. `*.spec.json` (normalized validated DesignSpec)

Artifact base name format:

```text
<template>-g<generatorVersion>-s<specHash12>
```

This naming strategy guarantees deterministic identity for equivalent specs.

## Architecture

```text
DesignSpec (zod strict schema)
  -> renderer.ts (@napi-rs/canvas)
  -> qa.ts (dimensions, clipping, overlap, contrast, footer spacing)
  -> publish adapters (gist/github)
```

### Key modules

- `src/spec.schema.ts` — strict schema + defaults + safe-frame derivation
- `src/renderer.ts` — deterministic render + sidecar metadata
- `src/qa.ts` — hard QA gate checks
- `src/templates/*.ts` — reusable GTM templates
- `src/publish/github.ts` — GitHub content publish with bounded retries
- `src/publish/gist.ts` — Gist publish with bounded retries

## Programmatic usage

```ts
import {
  buildGtmPipelineSpec,
  renderDesign,
  runQa,
  writeRenderArtifacts,
} from '@spectratools/graphic-designer';

const spec = buildGtmPipelineSpec({
  title: 'Launch Pipeline',
  stages: [
    { name: 'Discover', description: 'Find channels' },
    { name: 'Validate', description: 'Run experiments' },
    { name: 'Ship', description: 'Scale winners' },
  ],
});

const render = await renderDesign(spec, { generatorVersion: '0.1.0' });
const written = await writeRenderArtifacts(render, './output');
const qa = await runQa({ imagePath: written.imagePath, spec, metadata: written.metadata });
```

## Environment

Publishing to GitHub/Gist requires:

- `GITHUB_TOKEN`

## Guarantees and guardrails

- No browser render dependency in production path
- Canonical renderer (`renderDesign`) used by CLI + library
- Hard QA checks before publish (unless `--allowQaFail` explicitly used)
- Bounded retry/backoff for network publish operations
