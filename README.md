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

## Release process (Changesets + npm)

1. Add a changeset in every PR that should ship a package change:
   ```bash
   pnpm changeset
   ```
2. Merge the PR into `main`. The release workflow will create or update a **Version Packages** release PR when changesets are present.
3. Merge the release PR. That merge triggers publish and pushes only unpublished, versioned `@spectratools/*` packages to npm (`registry.npmjs.org`).
4. If `main` has no pending changesets and no unpublished versions, the workflow exits cleanly with an explicit skip message.

### Required repository secret

- `NPM_TOKEN`: npm automation token with publish access to `@spectratools` packages.

## License

MIT
