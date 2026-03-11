# @spectratools/graphic-designer-cli

## 0.14.0

### Minor Changes

- [#417](https://github.com/spectra-the-bot/spectra-tools/pull/417) [`ab5f2f8`](https://github.com/spectra-the-bot/spectra-tools/commit/ab5f2f855cafaa7f007ab0f59dd765307ae15b34) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add ring element type for cycle visualizations with colored arc segments, glow, arrows, and label.

### Patch Changes

- [#416](https://github.com/spectra-the-bot/spectra-tools/pull/416) [`cc86b4a`](https://github.com/spectra-the-bot/spectra-tools/commit/cc86b4a6dd3fead6f6f79c45d4a8698dc362d401) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add linear edge vignette mode with configurable top/bottom gradient fades.

- [#407](https://github.com/spectra-the-bot/spectra-tools/pull/407) [`23d12a9`](https://github.com/spectra-the-bot/spectra-tools/commit/23d12a9583876bce0aca505a05d794e42d26c90a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix stale command examples in docs to match current CLI output.

- Updated dependencies [[`58bed96`](https://github.com/spectra-the-bot/spectra-tools/commit/58bed96fd22615ae6654d630e2e4e5b15099089d), [`8f0c670`](https://github.com/spectra-the-bot/spectra-tools/commit/8f0c6707163c26bd1db88264ac217c7ee56007f5), [`a1b9638`](https://github.com/spectra-the-bot/spectra-tools/commit/a1b9638bbd2ba0e1479721b934612b93eaa35101)]:
  - @spectratools/cli-shared@0.4.0

## 0.13.0

### Minor Changes

- [#406](https://github.com/spectra-the-bot/spectra-tools/pull/406) [`db922d5`](https://github.com/spectra-the-bot/spectra-tools/commit/db922d5da8076cd1f345942c55d6021debd04a31) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add stats-bar draw command for rendering horizontally centered metric displays with mixed fonts and separators.

### Patch Changes

- Updated dependencies [[`152941a`](https://github.com/spectra-the-bot/spectra-tools/commit/152941a9a542bc33964e44f6ff9d253653fabdac)]:
  - @spectratools/cli-shared@0.3.0

## 0.12.3

### Patch Changes

- Updated dependencies [[`dad2a60`](https://github.com/spectra-the-bot/spectra-tools/commit/dad2a6071f23bbb75bd4028dfb2b79f8aa3c9dce)]:
  - @spectratools/cli-shared@0.2.1

## 0.12.2

### Patch Changes

- Updated dependencies [[`6f2d227`](https://github.com/spectra-the-bot/spectra-tools/commit/6f2d2272d310069f8cc936c22c3518d1f6e4ffcf)]:
  - @spectratools/cli-shared@0.2.0

## 0.12.1

### Patch Changes

- Updated dependencies [[`e5e4724`](https://github.com/spectra-the-bot/spectra-tools/commit/e5e47248d538c261e0fa8436bd1ba7c3f2807aaf)]:
  - @spectratools/cli-shared@0.1.2

## 0.12.0

### Minor Changes

- [#366](https://github.com/spectra-the-bot/spectra-tools/pull/366) [`f59f140`](https://github.com/spectra-the-bot/spectra-tools/commit/f59f1401627c9d624aa840d1cbea884b20186964) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add optional strokeGradient field to draw bezier and line commands for gradient-colored strokes.

- [#367](https://github.com/spectra-the-bot/spectra-tools/pull/367) [`f024f57`](https://github.com/spectra-the-bot/spectra-tools/commit/f024f570c74c2beb6f8b53983405ec088c67e05f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add ellipse layout mode that positions flow nodes on a configurable elliptical path.

## 0.11.0

### Minor Changes

- [#363](https://github.com/spectra-the-bot/spectra-tools/pull/363) [`9bbba8b`](https://github.com/spectra-the-bot/spectra-tools/commit/9bbba8b637a6175dfccde52f2a69ef130e02ade8) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add `curveMode` field to connection routing: `ellipse` mode traces arcs on a shared global ellipse using generalized kappa for smooth bezier curves. Add `ellipseRx`/`ellipseRy` layout parameters for explicit ellipse sizing, with automatic inference from node positions as fallback. Add `routing: 'straight'` for direct line connections. Deprecate `routing: 'arc'` as alias for `routing: 'curve', curveMode: 'ellipse'`.

## 0.10.1

### Patch Changes

- [#362](https://github.com/spectra-the-bot/spectra-tools/pull/362) [`1e1921d`](https://github.com/spectra-the-bot/spectra-tools/commit/1e1921d168fbc70f2a07eb26c02d911b73915e50) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix connection style field priority: `style` now takes precedence over deprecated `strokeStyle`. When `strokeStyle` is provided, a deprecation warning is emitted advising use of `style` instead.

## 0.10.0

### Minor Changes

- [#359](https://github.com/spectra-the-bot/spectra-tools/pull/359) [`682fedd`](https://github.com/spectra-the-bot/spectra-tools/commit/682fedd06713bb4b310eb5c596e8a1b29eb81eca) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add a new freestyle `arc` draw command with schema validation and canvas rendering support.

- [#360](https://github.com/spectra-the-bot/spectra-tools/pull/360) [`6139b8f`](https://github.com/spectra-the-bot/spectra-tools/commit/6139b8f846839f3ba2ebfc6f8a617ee59620063a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add optional from/to connection stroke colors for multi-routing gradient rendering.

- [#358](https://github.com/spectra-the-bot/spectra-tools/pull/358) [`4dcd147`](https://github.com/spectra-the-bot/spectra-tools/commit/4dcd147c173a7751f7faa496d8b324681c890512) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add optional iteration metadata support to render outputs and CLI render command flags.

## 0.9.0

### Minor Changes

- [#348](https://github.com/spectra-the-bot/spectra-tools/pull/348) [`13ec44d`](https://github.com/spectra-the-bot/spectra-tools/commit/13ec44d5aff4f96dae45ce5f7df365de4ed713af) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add left-edge accent bar renderer to flow-node elements.

- [#349](https://github.com/spectra-the-bot/spectra-tools/pull/349) [`2ceb165`](https://github.com/spectra-the-bot/spectra-tools/commit/2ceb1655f6b8dcfded3b790818b969fdc0653111) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add inner glow gradient overlay renderer to flow-node elements.

### Patch Changes

- [#352](https://github.com/spectra-the-bot/spectra-tools/pull/352) [`86e73cf`](https://github.com/spectra-the-bot/spectra-tools/commit/86e73cf1b91cbe7373f21e6d239aa0355ca23a2c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add test coverage for flow-node accent bar and inner glow decoration.

- [#350](https://github.com/spectra-the-bot/spectra-tools/pull/350) [`9ea9356`](https://github.com/spectra-the-bot/spectra-tools/commit/9ea9356a91d7fe16e42a3f6130103aa88d246f44) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Implement text-row draw command renderer with per-segment color/font overrides and alignment support.

## 0.8.0

### Minor Changes

- [#346](https://github.com/spectra-the-bot/spectra-tools/pull/346) [`be4e057`](https://github.com/spectra-the-bot/spectra-tools/commit/be4e057195b0eb4851dc4673d10f4cfe33169a1e) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add accentColor, accentBarWidth, glowColor, glowWidth, glowOpacity fields to flow-node element schema.

- [#345](https://github.com/spectra-the-bot/spectra-tools/pull/345) [`9e36a62`](https://github.com/spectra-the-bot/spectra-tools/commit/9e36a62e6f1d98c26ee25404899cc5d8fc8234d9) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add text-row draw command schema for mixed-style inline text rendering.

## 0.7.1

### Patch Changes

- [#336](https://github.com/spectra-the-bot/spectra-tools/pull/336) [`effc572`](https://github.com/spectra-the-bot/spectra-tools/commit/effc572995dc41f91660fd5921e03828997d9d98) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add optional shadow property to draw commands for drop-shadow and glow effects.

- [#335](https://github.com/spectra-the-bot/spectra-tools/pull/335) [`5c4ec93`](https://github.com/spectra-the-bot/spectra-tools/commit/5c4ec93397c14d4dfe9c372ed17b276db60424f0) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add optional cx, cy, innerRadius, outerRadius fields to radial gradient-rect for custom gradient positioning.

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
