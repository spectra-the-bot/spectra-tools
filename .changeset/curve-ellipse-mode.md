---
"@spectratools/graphic-designer-cli": minor
---

Add `curveMode` field to connection routing: `ellipse` mode traces arcs on a shared global ellipse using generalized kappa for smooth bezier curves. Add `ellipseRx`/`ellipseRy` layout parameters for explicit ellipse sizing, with automatic inference from node positions as fallback. Add `routing: 'straight'` for direct line connections. Deprecate `routing: 'arc'` as alias for `routing: 'curve', curveMode: 'ellipse'`.
