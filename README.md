# spectra-tools

Agent-friendly CLI tools built on the [incur](https://github.com/wevm/incur) framework.

## Packages

| Package | Description |
|---------|-------------|
| [`@spectratools/cli-shared`](./packages/shared) | Shared middleware, utilities, and testing helpers |
| [`@spectratools/etherscan-cli`](./packages/etherscan) | Etherscan API CLI |
| [`@spectratools/assembly-cli`](./packages/assembly) | Assembly CLI |
| [`@spectratools/xapi-cli`](./packages/xapi) | X (Twitter) API CLI |
| [`@spectratools/erc8004-cli`](./packages/erc8004) | ERC-8004 CLI |

## Documentation

- [CLI Output Contract v1 (Incur-aligned)](./docs/cli-output-contract-v1.md) — runtime contract split into incur-native guarantees + spectra package policy.
- [CLI Output Contract v1 — Implementation Plan (Incur-aligned)](./docs/cli-output-contract-implementation-plan.md) — low-risk rollout focused on docs/tests and targeted command-level improvements.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## License

MIT
