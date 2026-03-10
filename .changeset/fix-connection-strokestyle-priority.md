---
"@spectratools/graphic-designer-cli": patch
---

Fix connection style field priority: `style` now takes precedence over deprecated `strokeStyle`. When `strokeStyle` is provided, a deprecation warning is emitted advising use of `style` instead.
