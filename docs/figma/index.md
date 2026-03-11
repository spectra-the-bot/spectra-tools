# 🖼️ Figma CLI

`@spectratools/figma-cli` gives you scriptable access to Figma REST API data — files, nodes, components, comments, frames, and design tokens.

Use it to:
- inspect file metadata and pages
- list and inspect published components
- extract design tokens (DTCG, flat, or raw JSON)
- list frame metadata and render frame images
- read and post comments

::: tip Authentication required
Set `FIGMA_API_KEY` to a Figma personal access token before running commands.
:::

## Install

::: code-group

```bash [npm]
npm install -g @spectratools/figma-cli
```

```bash [pnpm]
pnpm add -g @spectratools/figma-cli
```

```bash [npx (no install)]
npx @spectratools/figma-cli files get <file-key>
```

:::

## Quick examples

```bash
# 1) Get file metadata
figma files get <file-key>

# 2) List files in a project
figma files list --project-id <project-id>

# 3) Inspect a specific node
figma nodes get <file-key> <node-id>

# 4) Export design tokens
figma tokens export <file-key> --format dtcg

# 5) List top-level frames
figma frames export <file-key>

# 6) Post a comment
figma comments post <file-key> --message "Looks great"
```

## Agent integration

```bash
# LLM-readable command manifest
figma --llms

# Register as a local skill
figma skills add

# Register as an MCP server
figma mcp add
```

## Reference

- [Command reference](/figma/commands) — full command list with arguments and examples
