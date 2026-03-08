# Getting Started

## Requirements

- Node.js 20+
- pnpm 9+

## Install

You can run CLIs globally or through `npx`.

```bash
# global install
pnpm add -g @spectratools/assembly-cli @spectratools/etherscan-cli @spectratools/xapi-cli @spectratools/erc8004-cli

# one-off execution
npx @spectratools/assembly-cli --help
npx @spectratools/etherscan-cli --help
npx @spectratools/xapi-cli --help
npx @spectratools/erc8004-cli --help
```

## First commands

```bash
# Assembly governance snapshot
assembly-cli status --format json

# Etherscan account balance lookup
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --format json

# X trends query
xapi-cli trends places --format json

# ERC-8004 discovery search
erc8004-cli discovery search --service mcp --limit 10 --format json
```

## Output formats

All CLIs support a shared global format flag:

```bash
--format <toon|json|yaml|md|jsonl>
```

Use format modes based on consumer:

- `toon`: default human-friendly terminal output
- `json`: structured output for scripts/agents
- `yaml`: readable config-style output
- `md`: markdown output for docs/changelogs
- `jsonl`: streaming/line-oriented machine pipelines

You can also use:

```bash
--schema      # print command JSON Schema
--llms        # print CLI manifest in markdown
--filter-output <keys>
```
