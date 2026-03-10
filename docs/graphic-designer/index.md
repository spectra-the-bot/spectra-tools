# 🎨 Graphic Designer CLI

`@spectratools/graphic-designer-cli` is a deterministic visual content generator — code screenshots, terminal shots, flowcharts, and infographics. No browser dependency.

Use it to create:
- code screenshots with syntax highlighting
- terminal session captures
- flowcharts and diagrams
- infographics and visual layouts

Connection routing modes: `auto`, `orthogonal`, `curve`, `arc`.
You can also set `layout.diagramCenter` to explicitly control curve/arc bow direction.

It is designed for:
- **developers** who need shareable code visuals without browser tools
- **content creators** generating consistent, reproducible graphics
- **agents/automation** that need deterministic image generation

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/graphic-designer-cli --help
```

```bash [npm]
npm install -g @spectratools/graphic-designer-cli
```

```bash [pnpm]
pnpm add -g @spectratools/graphic-designer-cli
```

:::

## Quick examples

```bash
# Generate a code screenshot
design code --file src/index.ts --out screenshot.png

# Create a terminal shot
design terminal --file session.log --out terminal.png
```

## Reference

- [Command reference](/graphic-designer/commands)
