# @spectratools/graphic-designer-cli

Deterministic visual content generator for code screenshots, terminal shots, flowcharts, infographics, and hero graphics. No browser dependency — renders directly to PNG via [@napi-rs/canvas](https://github.com/nicolo-ribaudo/napi-rs-canvas).

## Features

- **Carbon-quality code screenshots** — macOS window chrome, drop shadows, colored surrounds, syntax highlighting via [shiki](https://shiki.matsu.io)
- **Terminal screenshots** — command + output rendering with the same polished frame
- **Flowcharts** — auto-layout via [ELK.js](https://github.com/kieler/elkjs) with 5 algorithms (layered, stress, force, radial, box)
- **Freestyle draw layer** — 8 draw command types for hero graphics and custom compositions
- **Built-in QA** — automated checks for clipping, contrast, bounds, and content safety
- **Deterministic output** — same spec + version = same artifact hash
- **Bundled fonts** — Inter, JetBrains Mono, Space Grotesk (no system font dependency)
- **6 built-in themes** — dark, light, dracula, github-dark, one-dark, nord

## Install

```bash
pnpm add @spectratools/graphic-designer-cli
# or global CLI
pnpm add -g @spectratools/graphic-designer-cli
```

## CLI

### Code Screenshot

```bash
design template code \
  --file ./src/index.ts \
  --language typescript \
  --title "index.ts" \
  --theme dark \
  --show-line-numbers \
  --out ./output/
```

Options: `--surround-color <hex>`, `--window-controls <macos|bw|none>`, `--scale <1|2|4>`

### Terminal Screenshot

```bash
design template terminal \
  --command "pnpm test" \
  --output "✓ 63 tests passed" \
  --title "~/spectra-tools" \
  --theme dark \
  --out ./output/
```

### Flowchart

```bash
design template flowchart \
  --nodes "Lint,Test,Build,Deploy" \
  --edges "Lint->Test,Test->Build,Build->Deploy" \
  --algorithm stress \
  --out ./output/
```

### Cards

```bash
design template cards \
  --cards '[{"title":"Lint","body":"Static analysis"},{"title":"Test","body":"Unit + integration"},{"title":"Build","body":"Production bundle"}]' \
  --out ./output/
```

Options: `--title <text>`, `--subtitle <text>`, `--columns <n>`, `--theme <name>`, `--width <px>`, `--height <px>`

### Render from Spec

```bash
design render --spec ./design.json --out ./output/
design qa --in ./output/design-v2-*.png --spec ./output/design-v2-*.spec.json
design publish --in ./output/design-v2-*.png --target gist
```

### Compare Rendered Output to Target

```bash
design compare \
  --target ./designs/reference.png \
  --rendered ./output/design-v2-g0.4.0-sabc123.png \
  --grid 3 \
  --threshold 0.8 \
  --format json
```

Returns overall similarity, per-region (A1..Cn) similarity scores, and verdict (`match`, `close`, `mismatch`).

## Carbon-Style Rendering

Code and terminal screenshots use design parameters inspired by [Carbon](https://carbon.now.sh) (MIT):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `paddingVertical` | 56px | Space above/below code container |
| `paddingHorizontal` | 56px | Space left/right of code container |
| `windowControls` | `macos` | Traffic light dots style (`macos`, `bw`, `none`) |
| `dropShadow` | `true` | Floating card shadow effect |
| `dropShadowBlurRadius` | 68px | Shadow gaussian blur |
| `surroundColor` | `rgba(171,184,195,1)` | Background color around the code container |
| `scale` | 2 | Export scale factor (2x for retina) |

Override via CLI flags or the `style` field in DesignSpec elements.

## DesignSpec

The core schema supports 8 element types:

- `card` — titled content cards
- `flow-node` — flowchart nodes with labels, sublabels, colors
- `connection` — edges between nodes with arrowheads and ELK routing
- `code-block` — syntax-highlighted code with Carbon-style frame
- `terminal` — command/output with Carbon-style frame
- `text` — standalone text blocks
- `shape` — rectangles, circles, rounded-boxes
- `image` — embedded images

Plus a **freestyle draw layer** with 8 draw command types: `rect`, `circle`, `text`, `line`, `bezier`, `path`, `badge`, `gradient-rect`.

### Layout Modes

- **auto** — ELK.js layout engine (layered, stress, force, radial, box algorithms)
- **grid** — column-based grid layout
- **stack** — vertical or horizontal stack
- **manual** — explicit x/y coordinates

## Programmatic Usage

```ts
import {
  parseDesignSpec,
  renderDesign,
  runQa,
  writeRenderArtifacts,
} from '@spectratools/graphic-designer-cli';

const spec = parseDesignSpec({
  version: 2,
  theme: 'dark',
  header: { title: 'My Diagram', align: 'center' },
  elements: [
    { type: 'flow-node', id: 'a', label: 'Start', shape: 'rounded-box', color: '#7c3aed' },
    { type: 'flow-node', id: 'b', label: 'End', shape: 'rounded-box', color: '#059669' },
    { type: 'connection', from: 'a', to: 'b', label: 'next' },
  ],
  layout: { mode: 'auto', algorithm: 'layered' },
});

const render = await renderDesign(spec, { generatorVersion: '0.3.0' });
const written = await writeRenderArtifacts(render, './output');
const qa = await runQa({ imagePath: written.imagePath, spec, metadata: written.metadata });
console.log(qa.pass ? '✅ QA passed' : `❌ ${qa.issueCount} issues`);
```

## Output Files

`design render` produces three files:

```
design-v2-g<version>-s<specHash>.png        # rendered image
design-v2-g<version>-s<specHash>.meta.json  # metadata (dimensions, hash, QA, scale)
design-v2-g<version>-s<specHash>.spec.json  # normalized validated spec
```

## Themes

| Theme | Background |
|-------|------------|
| `dark` | Deep navy (`#0d1117`) |
| `light` | Clean white (`#ffffff`) |
| `dracula` | Classic purple-dark (`#282a36`) |
| `github-dark` | GitHub's dark mode |
| `one-dark` | Atom One Dark |
| `nord` | Arctic blue palette |

Custom theme overrides are supported via the `themeOverrides` field in DesignSpec.

## Agent Workflow

For AI agents using this tool in a self-correcting loop,
see [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md) for the recommended
render → compare → QA → iterate workflow.

## Credits

- Code screenshot styling inspired by [Carbon](https://carbon.now.sh) (MIT)
- Layout engine powered by [ELK.js](https://github.com/kieler/elkjs) (EPL-2.0)
- Syntax highlighting by [shiki](https://shiki.matsu.io) (MIT)
- Canvas rendering by [@napi-rs/canvas](https://github.com/nicolo-ribaudo/napi-rs-canvas) (MIT)

## License

MIT
