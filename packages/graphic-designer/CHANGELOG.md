# @spectratools/graphic-designer-cli

## 0.7.0

### Minor Changes

- [#334](https://github.com/spectra-the-bot/spectra-tools/pull/334) [`099d4e2`](https://github.com/spectra-the-bot/spectra-tools/commit/099d4e29dd30bd2990a50a6afb6286dcc5528256) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add fromAnchor and toAnchor properties to connection elements for precise edge departure/arrival control.

### Patch Changes

- [#331](https://github.com/spectra-the-bot/spectra-tools/pull/331) [`4d2aba4`](https://github.com/spectra-the-bot/spectra-tools/commit/4d2aba47d196f9433b276c394942582270535061) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add grid draw command type to schema and renderer.

- [#333](https://github.com/spectra-the-bot/spectra-tools/pull/333) [`bbd85ba`](https://github.com/spectra-the-bot/spectra-tools/commit/bbd85ba8644c3b11592cb6805012f1f4ee2843cd) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add arrowPlacement boundary mode to connection elements for precise curve-following arrowhead placement.

- [#330](https://github.com/spectra-the-bot/spectra-tools/pull/330) [`5fde170`](https://github.com/spectra-the-bot/spectra-tools/commit/5fde17055d2ebc6b0a93dc26902ffe2d9355e57f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add bezierTangentAt and findBoundaryIntersection utilities to connection renderer.

## 0.6.0

### Minor Changes

- [#285](https://github.com/spectra-the-bot/spectra-tools/pull/285) [`b4d83e9`](https://github.com/spectra-the-bot/spectra-tools/commit/b4d83e97236a164605bb5a83cfa4852794c3e663) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add routing: curve option to connection elements with configurable tension for smooth bezier paths.

## 0.5.0

### Minor Changes

- [#315](https://github.com/spectra-the-bot/spectra-tools/pull/315) [`cd6cfb2`](https://github.com/spectra-the-bot/spectra-tools/commit/cd6cfb2277ecf41f435b57775378b95bb92dbaf7) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add a design compare command with structural similarity scoring and per-region verdict reporting.

- [#318](https://github.com/spectra-the-bot/spectra-tools/pull/318) [`59867e3`](https://github.com/spectra-the-bot/spectra-tools/commit/59867e361ae4dd3b561f238db1611ea44ccd45ba) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add optional --reference flag to design qa for reference image comparison.

### Patch Changes

- [#317](https://github.com/spectra-the-bot/spectra-tools/pull/317) [`14febde`](https://github.com/spectra-the-bot/spectra-tools/commit/14febde50f01ef098e8a13c3a3d62143aa14d9df) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add AGENT_WORKFLOW.md with self-check loop documentation and link from README.

- [#309](https://github.com/spectra-the-bot/spectra-tools/pull/309) [`417821a`](https://github.com/spectra-the-bot/spectra-tools/commit/417821aced1dfdd32cfe12bb45e51f968cd7da61) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add shadow/glow effect support to flow-node elements via shadow property.

## 0.4.0

### Minor Changes

- [#278](https://github.com/spectra-the-bot/spectra-tools/pull/278) [`c65fe96`](https://github.com/spectra-the-bot/spectra-tools/commit/c65fe961c423d2fdc1fd3bb0ec389fa4073688bb) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add support for rgba() and rgb() color syntax in addition to hex colors.

- [#280](https://github.com/spectra-the-bot/spectra-tools/pull/280) [`f39c6d8`](https://github.com/spectra-the-bot/spectra-tools/commit/f39c6d8838c5dd03602b7f3f203c40502817b24a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add fillOpacity property to flow-node elements for translucent fill support.

- [#282](https://github.com/spectra-the-bot/spectra-tools/pull/282) [`e911176`](https://github.com/spectra-the-bot/spectra-tools/commit/e9111763a17f3a7e37db2b24fa60bc791b8b094d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add sublabel2, sublabel2Color, sublabel2FontSize properties to flow-node elements for three-line text support.

- [#281](https://github.com/spectra-the-bot/spectra-tools/pull/281) [`1623c0e`](https://github.com/spectra-the-bot/spectra-tools/commit/1623c0e8741f07898b9aa6e7c50a8236d562cad7) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add badgeText, badgeColor, badgeBackground, badgePosition properties to flow-node elements for inline badge/tag rendering.

### Patch Changes

- [#292](https://github.com/spectra-the-bot/spectra-tools/pull/292) [`f785643`](https://github.com/spectra-the-bot/spectra-tools/commit/f7856437ac414e8ee6a5467b6bda1f61343e0133) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add radialRoot, radialRadius, radialCompaction, radialSortBy options to ELK radial layout configuration.

## 0.3.2

### Patch Changes

- [#276](https://github.com/spectra-the-bot/spectra-tools/pull/276) [`8ce607e`](https://github.com/spectra-the-bot/spectra-tools/commit/8ce607e939b8435d036f0d4759747792fdcee7f3) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add JSDoc documentation to all exported functions and constants.

- [#274](https://github.com/spectra-the-bot/spectra-tools/pull/274) [`7779859`](https://github.com/spectra-the-bot/spectra-tools/commit/777985936699e910eafdff70de9cfc69d1bcc1b1) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Replace local retry/HTTP utilities with @spectratools/cli-shared equivalents.

## 0.3.1

### Patch Changes

- [#242](https://github.com/spectra-the-bot/spectra-tools/pull/242) [`4e7ca4b`](https://github.com/spectra-the-bot/spectra-tools/commit/4e7ca4b27bdae5365757cd37bc7e09670e6c58f0) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Bump incur dependency from ^0.2.2 to ^0.3.0 to match all other packages.

- [#254](https://github.com/spectra-the-bot/spectra-tools/pull/254) [`13a4bf4`](https://github.com/spectra-the-bot/spectra-tools/commit/13a4bf4704732e41854f2a2fd77787d97ad71b48) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix tsup config: restrict shebang to CLI entry only, add missing subpath build entries.

- [#255](https://github.com/spectra-the-bot/spectra-tools/pull/255) [`678248c`](https://github.com/spectra-the-bot/spectra-tools/commit/678248c33ce3085c73b1736834a4215a72c8976d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix README cards example to use correct --cards flag with JSON array syntax.

- [#265](https://github.com/spectra-the-bot/spectra-tools/pull/265) [`aacbb08`](https://github.com/spectra-the-bot/spectra-tools/commit/aacbb082ba6f9ec5daad0ab78fa1e3ce9092ff30) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add missing 0.3.0 CHANGELOG entry.

- [#251](https://github.com/spectra-the-bot/spectra-tools/pull/251) [`23d8bc7`](https://github.com/spectra-the-bot/spectra-tools/commit/23d8bc7befa7c555d3dca3305385b9d3750318b9) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Rename package from @spectratools/graphic-designer to @spectratools/graphic-designer-cli to match monorepo naming convention.

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
