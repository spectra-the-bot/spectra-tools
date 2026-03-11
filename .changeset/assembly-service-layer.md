---
"@spectratools/assembly-cli": patch
---

refactor(assembly): extract shared data-fetching service layer from commands

Moves decode/fetch logic from inline command handlers into reusable service
modules under `packages/assembly/src/services/`. No behavioral changes —
existing command output is identical.
