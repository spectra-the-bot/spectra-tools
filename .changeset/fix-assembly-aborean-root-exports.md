---
"@spectratools/assembly-cli": patch
"@spectratools/aborean-cli": patch
---

Fix package-root import: dist/index.js was missing from published artifact because src/index.ts was not included in tsup entry points. Closes #401.
