# spectra-tools

CLI tools for the Abstract ecosystem — query governance, explore chains, monitor social feeds, and discover onchain agents.

**[📖 Documentation](https://spectra-the-bot.github.io/spectra-tools/)**

## Quick start

No install required:

```bash
# Check Assembly governance status on Abstract
npx @spectratools/assembly-cli status

# Look up an Ethereum account balance
npx @spectratools/etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum

# Search posts on X
npx @spectratools/xapi-cli posts search "abstract chain" --max-results 5
```

## CLIs

| CLI | What it does | Status |
|-----|-------------|--------|
| [**Assembly CLI**](https://spectra-the-bot.github.io/spectra-tools/assembly/) | Governance proposals, council, treasury, forum, and members on Abstract | ✅ Stable |
| [**Etherscan CLI**](https://spectra-the-bot.github.io/spectra-tools/etherscan/) | Balances, transactions, logs, contracts, tokens, and gas across EVM chains | ✅ Stable |
| [**X API CLI**](https://spectra-the-bot.github.io/spectra-tools/xapi/) | Posts, timelines, users, lists, trends, and DMs via X API v2 | ✅ Stable |
| [**ERC-8004 CLI**](https://spectra-the-bot.github.io/spectra-tools/erc8004/) | Agent identity, reputation, and validation registries on Abstract | 🧪 Preview |
| **Graphic Designer CLI** (`design`) | Deterministic infographic rendering + QA/publish pipeline for GTM assets | 🧪 Preview |

## Built for agents

Every CLI outputs structured data and includes built-in agent integration:

```bash
# JSON output for scripts and agents
assembly-cli governance proposals --json

# Compact command index
assembly-cli --llms

# Full CLI manifest
assembly-cli --llms-full

# Register as an agent skill or MCP server
assembly-cli skills add
assembly-cli mcp add
```

All CLIs support `--format json`, `--schema`, `--llms`, `--llms-full`, `skills add`, and `mcp add` out of the box.

→ [Agent integration guide](https://spectra-the-bot.github.io/spectra-tools/agent-integration)

## Install

```bash
# Install globally
npm install -g @spectratools/assembly-cli

# Or use any package manager
pnpm add -g @spectratools/assembly-cli
```

Install only the CLIs you need — they're independent packages.

## Documentation

Full docs, command references, and configuration guides:

**https://spectra-the-bot.github.io/spectra-tools/**

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for CI guardrails, release safety checks, and PR review expectations.

### Development setup

```bash
git clone https://github.com/spectra-the-bot/spectra-tools.git
cd spectra-tools
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

### Docs

```bash
pnpm docs:dev       # local preview
pnpm docs:generate  # rebuild command references
pnpm docs:build     # production build
```

### Release process

1. Add a changeset: `pnpm changeset`
2. Merge to `main` — the release workflow creates a Version Packages PR
3. Merge the release PR to publish to npm

Runbook: keep `main` branch protection `strict: true` with required status check `CI`.

Required repository secret: `NPM_TOKEN` with publish access to `@spectratools`.

## License

MIT
