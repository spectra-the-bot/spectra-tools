# design

## design publish

### design publish

Publish deterministic artifacts to gist or github (QA gate required by default).

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--in` | `string` |  | Path to rendered PNG |
| `--target` | `string` |  | Publish target |
| `--spec` | `string` |  | Path to DesignSpec JSON (default: infer from sidecar name) |
| `--meta` | `string` |  | Path to metadata sidecar JSON (default: infer from image name) |
| `--allowQaFail` | `boolean` | `false` | Bypass QA gate (not recommended) |
| `--repo` | `string` |  | GitHub target repo in owner/name format (github target only) |
| `--branch` | `string` |  | GitHub branch (default: main) |
| `--pathPrefix` | `string` |  | GitHub path prefix for uploads (default: artifacts) |
| `--gistId` | `string` |  | Existing gist id to update (gist target only) |
| `--description` | `string` |  | Publish description/commit message |
| `--public` | `boolean` | `false` | Publish gist publicly (gist target only) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | `string` | yes |  |
| `qa` | `object` | yes |  |
| `qa.pass` | `boolean` | yes |  |
| `qa.issueCount` | `number` | yes |  |
| `publish` | `object` | yes |  |
| `publish.attempts` | `number` | yes |  |
| `publish.summary` | `string` | yes |  |
| `publish.url` | `string` | no |  |

#### Examples

```sh
# Publish a rendered design to a gist with retry/backoff
design publish --in ./output/design-v2-g0.2.0-sabc123.png --target gist

# Publish artifact + sidecar metadata into a GitHub repository path
design publish --in ./output/design-v2-g0.2.0-sabc123.png --target github --repo spectra-the-bot/spectra-tools --branch main
```

## design qa

### design qa

Run hard QA checks against a rendered image + spec (and optional sidecar metadata).

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--in` | `string` |  | Path to rendered PNG |
| `--spec` | `string` |  | Path to normalized DesignSpec JSON |
| `--meta` | `string` |  | Optional sidecar metadata path (.meta.json) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pass` | `boolean` | yes |  |
| `checkedAt` | `string` | yes |  |
| `imagePath` | `string` | yes |  |
| `issueCount` | `number` | yes |  |
| `issues` | `array` | yes |  |
| `issues[].code` | `string` | yes |  |
| `issues[].severity` | `string` | yes |  |
| `issues[].message` | `string` | yes |  |
| `issues[].elementId` | `string` | no |  |

#### Examples

```sh
# Validate dimensions, clipping, overlap, contrast, and footer spacing
design qa --in ./output/design-v2-g0.2.0-sabc123.png --spec ./output/design-v2-g0.2.0-sabc123.spec.json
```

## design render

### design render

Render a deterministic design artifact from a DesignSpec JSON file.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--spec` | `string` |  | Path to DesignSpec JSON file (or "-" to read JSON from stdin) |
| `--out` | `string` |  | Output file path (.png) or output directory |
| `--specOut` | `string` |  | Optional explicit output path for normalized spec JSON |
| `--allowQaFail` | `boolean` | `false` | Allow render success even if QA fails |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imagePath` | `string` | yes |  |
| `metadataPath` | `string` | yes |  |
| `specPath` | `string` | yes |  |
| `artifactHash` | `string` | yes |  |
| `specHash` | `string` | yes |  |
| `layoutMode` | `string` | yes |  |
| `qa` | `object` | yes |  |
| `qa.pass` | `boolean` | yes |  |
| `qa.issueCount` | `number` | yes |  |
| `qa.issues` | `array` | yes |  |
| `qa.issues[].code` | `string` | yes |  |
| `qa.issues[].severity` | `string` | yes |  |
| `qa.issues[].message` | `string` | yes |  |
| `qa.issues[].elementId` | `string` | no |  |

#### Examples

```sh
# Render a design spec and write .png/.meta/.spec artifacts
design render --spec ./specs/pipeline.json --out ./output
```

## design template

Generate common design templates and run the full render → QA pipeline.

### design template cards

Build and render a card grid from JSON card input.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--cards` | `string` |  | JSON array of cards: [{"title":"...","body":"...","metric":"..."}] |
| `--title` | `string` |  | Header title |
| `--subtitle` | `string` |  | Header subtitle |
| `--columns` | `number` |  | Grid columns (default: auto) |
| `--theme` | `string` | `dark` | Theme name |
| `--width` | `number` |  | Canvas width override |
| `--height` | `number` |  | Canvas height override |
| `--out` | `string` |  | Output file path (.png) or output directory |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imagePath` | `string` | yes |  |
| `metadataPath` | `string` | yes |  |
| `specPath` | `string` | yes |  |
| `artifactHash` | `string` | yes |  |
| `specHash` | `string` | yes |  |
| `layoutMode` | `string` | yes |  |
| `qa` | `object` | yes |  |
| `qa.pass` | `boolean` | yes |  |
| `qa.issueCount` | `number` | yes |  |
| `qa.issues` | `array` | yes |  |
| `qa.issues[].code` | `string` | yes |  |
| `qa.issues[].severity` | `string` | yes |  |
| `qa.issues[].message` | `string` | yes |  |
| `qa.issues[].elementId` | `string` | no |  |

### design template code

Build and render a code screenshot from inline code or a source file.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--code` | `string` |  | Inline code string (mutually exclusive with --file) |
| `--file` | `string` |  | Path to a source file to render |
| `--language` | `string` |  | Language for syntax highlighting |
| `--lines` | `string` |  | Optional line range to extract (example: 10-25) |
| `--title` | `string` |  | Optional code block title |
| `--theme` | `string` | `dark` | Theme name |
| `--showLineNumbers` | `boolean` | `false` | Show line numbers |
| `--highlightLines` | `string` |  | Comma-separated line numbers to highlight (example: 3,4,5) |
| `--surroundColor` | `string` |  | Outer surround color (default: rgba(171, 184, 195, 1)) |
| `--windowControls` | `string` | `macos` | Window chrome controls style |
| `--scale` | `number` | `2` | Export scale factor |
| `--width` | `number` |  | Canvas width override |
| `--height` | `number` |  | Canvas height override |
| `--out` | `string` |  | Output file path (.png) or output directory |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imagePath` | `string` | yes |  |
| `metadataPath` | `string` | yes |  |
| `specPath` | `string` | yes |  |
| `artifactHash` | `string` | yes |  |
| `specHash` | `string` | yes |  |
| `layoutMode` | `string` | yes |  |
| `qa` | `object` | yes |  |
| `qa.pass` | `boolean` | yes |  |
| `qa.issueCount` | `number` | yes |  |
| `qa.issues` | `array` | yes |  |
| `qa.issues[].code` | `string` | yes |  |
| `qa.issues[].severity` | `string` | yes |  |
| `qa.issues[].message` | `string` | yes |  |
| `qa.issues[].elementId` | `string` | no |  |

### design template flowchart

Build and render a flowchart from concise node/edge input.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--nodes` | `string` |  | Comma-separated node names, optionally with :shape (example: Decision:diamond) |
| `--edges` | `string` |  | Comma-separated edges as From->To or From->To:label |
| `--title` | `string` |  | Optional header title |
| `--direction` | `string` | `TB` | Auto-layout direction |
| `--algorithm` | `string` | `layered` | Auto-layout algorithm |
| `--theme` | `string` | `dark` | Theme name |
| `--nodeShape` | `string` |  | Default shape for nodes without explicit :shape |
| `--width` | `number` |  | Canvas width override |
| `--height` | `number` |  | Canvas height override |
| `--out` | `string` |  | Output file path (.png) or output directory |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imagePath` | `string` | yes |  |
| `metadataPath` | `string` | yes |  |
| `specPath` | `string` | yes |  |
| `artifactHash` | `string` | yes |  |
| `specHash` | `string` | yes |  |
| `layoutMode` | `string` | yes |  |
| `qa` | `object` | yes |  |
| `qa.pass` | `boolean` | yes |  |
| `qa.issueCount` | `number` | yes |  |
| `qa.issues` | `array` | yes |  |
| `qa.issues[].code` | `string` | yes |  |
| `qa.issues[].severity` | `string` | yes |  |
| `qa.issues[].message` | `string` | yes |  |
| `qa.issues[].elementId` | `string` | no |  |

### design template terminal

Build and render a terminal screenshot from command/output or raw content.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--command` | `string` |  | Command to show |
| `--output` | `string` |  | Command output text |
| `--content` | `string` |  | Raw terminal content (alternative to command/output) |
| `--title` | `string` |  | Window title |
| `--prompt` | `string` | `$ ` | Prompt prefix used for formatted command mode |
| `--windowControls` | `string` | `macos` | Window chrome controls style |
| `--surroundColor` | `string` |  | Outer surround color (default: rgba(171, 184, 195, 1)) |
| `--scale` | `number` | `2` | Export scale factor |
| `--theme` | `string` | `dark` | Theme name |
| `--width` | `number` |  | Canvas width override |
| `--height` | `number` |  | Canvas height override |
| `--out` | `string` |  | Output file path (.png) or output directory |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imagePath` | `string` | yes |  |
| `metadataPath` | `string` | yes |  |
| `specPath` | `string` | yes |  |
| `artifactHash` | `string` | yes |  |
| `specHash` | `string` | yes |  |
| `layoutMode` | `string` | yes |  |
| `qa` | `object` | yes |  |
| `qa.pass` | `boolean` | yes |  |
| `qa.issueCount` | `number` | yes |  |
| `qa.issues` | `array` | yes |  |
| `qa.issues[].code` | `string` | yes |  |
| `qa.issues[].severity` | `string` | yes |  |
| `qa.issues[].message` | `string` | yes |  |
| `qa.issues[].elementId` | `string` | no |  |
