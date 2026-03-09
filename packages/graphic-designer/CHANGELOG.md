# @spectratools/graphic-designer-cli

## 0.3.0

### Minor Changes

- [`c6ced08`](https://github.com/spectra-the-bot/spectra-tools/commit/c6ced0888b126088e3f55a54b467a3fb9109fb33) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Major redesign: Carbon-style code/terminal rendering with macOS window chrome and drop shadows, ELK.js layout engine replacing dagre (5 algorithms, 3 edge routing modes), freestyle draw layer with 8 command types, 6 built-in themes (dark, light, dracula, github-dark, one-dark, nord), Shiki syntax highlighting with fallback tokenizer, bundled fonts (Inter, JetBrains Mono, Space Grotesk), and expanded schema options for headers, flow-nodes, connections, and code/terminal styles.

### Patch Changes

- [`33495da`](https://github.com/spectra-the-bot/spectra-tools/commit/33495da35e15fe2974e487cb0c2a64dd27e2c1b7) — Apply biome fixes and remove explicit any.
- [`4efa1da`](https://github.com/spectra-the-bot/spectra-tools/commit/4efa1da0ba4a05cc4672c226b8607adfacc521b6) — Resolve elkjs NodeNext typecheck errors.
- [`a296dbd`](https://github.com/spectra-the-bot/spectra-tools/commit/a296dbdfed95fc31c76808d18042d99fe75e3aeb) — Preserve highlighter errors for unsupported syntax.
- [#254](https://github.com/spectra-the-bot/spectra-tools/pull/254) [`13a4bf4`](https://github.com/spectra-the-bot/spectra-tools/commit/13a4bf4704732e41854f2a2fd77787d97ad71b48) — Restrict shebang to CLI entry, add missing subpath build entries.
- [#255](https://github.com/spectra-the-bot/spectra-tools/pull/255) [`678248c`](https://github.com/spectra-the-bot/spectra-tools/commit/678248c33ce3085c73b1736834a4215a72c8976d) — Fix README cards flag example.

## 0.2.0

### Minor Changes

- [#184](https://github.com/spectra-the-bot/spectra-tools/pull/184) [`b60200e`](https://github.com/spectra-the-bot/spectra-tools/commit/b60200e1356a5a591603137774e1d812494467cf) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add the new `@spectratools/graphic-designer-cli` package with deterministic `@napi-rs/canvas` rendering, hard QA checks, GTM templates, and gist/github publish adapters.
