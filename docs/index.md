# spectra-tools

`spectra-tools` is a pnpm monorepo of agent-friendly CLIs for onchain governance, explorer data, social graph workflows, and ERC-8004 trustless agent operations.

All CLIs are built on [incur](https://github.com/wevm/incur), which provides:

- consistent command schemas and help output
- machine-readable manifests via `--llms`
- built-in `skills add` and `mcp add` registration
- structured output formats for human and agent consumers

## Packages

| Package | Scope | npm | Docs |
|---|---|---|---|
| `assembly-cli` | Assembly governance on Abstract (`members`, `council`, `forum`, `governance`, `treasury`) | [`@spectratools/assembly-cli`](https://www.npmjs.com/package/@spectratools/assembly-cli) | [Package guide](/assembly/) · [Commands](/assembly/commands) |
| `etherscan-cli` | Etherscan V2 API workflows (`account`, `contract`, `tx`, `token`, `gas`, `stats`) | [`@spectratools/etherscan-cli`](https://www.npmjs.com/package/@spectratools/etherscan-cli) | [Package guide](/etherscan/) · [Commands](/etherscan/commands) |
| `xapi-cli` | X (Twitter) API v2 automation (`posts`, `users`, `timeline`, `lists`, `trends`, `dm`) | [`@spectratools/xapi-cli`](https://www.npmjs.com/package/@spectratools/xapi-cli) | [Package guide](/xapi/) · [Commands](/xapi/commands) |
| `erc8004-cli` | ERC-8004 identity, reputation, validation, and discovery on Abstract | [`@spectratools/erc8004-cli`](https://www.npmjs.com/package/@spectratools/erc8004-cli) | [Package guide](/erc8004/) · [Commands](/erc8004/commands) |

## Documentation workflow

- Package command references are generated automatically from each CLI's `--llms` output.
- Run `pnpm docs:generate` to rebuild references locally.
- Run `pnpm docs:dev` for local preview or `pnpm docs:build` for production artifacts.
