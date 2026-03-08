---
---

fix(docs): use root base for custom domain deployments

Fixes VitePress base path resolution to use `/` for custom domain deployments (default) and `/spectra-tools/` for GitHub Pages. Adds asset-path verification to prevent GitHub Pages prefixes in custom domain builds.
