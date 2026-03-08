# @spectra-the-bot/assembly-cli

Assembly governance CLI for the Abstract ecosystem. Built on [incur](https://github.com/wevm/incur).

The CLI is organized into 5 command groups:

- `proposals` — list/get/vote on governance proposals
- `council` — inspect council members and seats
- `forum` — browse governance forum posts
- `members` — inspect member registry and membership status
- `votes` — view vote history and proposal tallies

## Installation

```bash
pnpm add -g @spectra-the-bot/assembly-cli
```

## Configuration

Set environment variables before running commands:

| Variable | Required | Description |
|---|---|---|
| `ASSEMBLY_API_URL` | No | Base URL for the Assembly API (defaults to `https://api.assembly.abs.xyz`) |
| `ASSEMBLY_API_KEY` | No* | API key sent as `X-Api-Key` header |
| `ABSTRACT_WALLET_ADDRESS` | No | Default wallet address used by `members status` when `--address` is omitted |

\* Some deployments/endpoints may require an API key.

Example setup:

```bash
export ASSEMBLY_API_URL="https://api.assembly.abs.xyz"
export ASSEMBLY_API_KEY="your_api_key"
export ABSTRACT_WALLET_ADDRESS="0x1234...abcd"
```

## Usage

```bash
assembly-cli <group> <command> [args] [options]
```

---

## Commands

### Proposals

```bash
# List proposals
assembly-cli proposals list [--status active|passed|rejected|all]

# Get one proposal
assembly-cli proposals get <id>

# Vote on a proposal
assembly-cli proposals vote <id> <for|against|abstain> [--reason "optional reason"]
```

Examples:

```bash
assembly-cli proposals list
assembly-cli proposals list --status active
assembly-cli proposals get 42
assembly-cli proposals vote 42 for --reason "Supports treasury transparency improvements"
```

### Council

```bash
# List council members
assembly-cli council members [--status active|inactive|all]

# Get member details by address
assembly-cli council info <address>

# List council seats
assembly-cli council seats [--status open|filled|all]
```

Examples:

```bash
assembly-cli council members
assembly-cli council members --status all
assembly-cli council info 0xabc123...
assembly-cli council seats --status open
```

### Forum

```bash
# List forum posts
assembly-cli forum posts [--category governance|general|all]

# Get a forum post by id
assembly-cli forum post <id>

# Search forum posts
assembly-cli forum search <query>
```

Examples:

```bash
assembly-cli forum posts
assembly-cli forum posts --category governance
assembly-cli forum post post-123
assembly-cli forum search "delegate incentives"
```

### Members

```bash
# List members
assembly-cli members list [--role council|voter|all]

# Get member details
assembly-cli members info <address>

# Check membership status
assembly-cli members status [--address <address>]
```

Examples:

```bash
assembly-cli members list
assembly-cli members list --role voter
assembly-cli members info 0xabc123...
assembly-cli members status --address 0xabc123...
# or uses ABSTRACT_WALLET_ADDRESS if set:
assembly-cli members status
```

### Votes

```bash
# Vote history
assembly-cli votes history [--voter <address>] [--proposal <id>]

# Proposal tally
assembly-cli votes tally <proposalId>
```

Examples:

```bash
assembly-cli votes history
assembly-cli votes history --voter 0xabc123...
assembly-cli votes history --proposal 42
assembly-cli votes tally 42
```

---

## Output formats

### Human-readable (default)

```bash
assembly-cli proposals list
```

### JSON (agent/script-friendly)

```bash
assembly-cli proposals list --format json
assembly-cli votes tally 42 --format json
```

Example JSON envelope:

```json
{
  "ok": true,
  "data": [
    {
      "id": "42",
      "title": "Treasury Reallocation",
      "status": "active",
      "proposer": "0xabc123...",
      "votes": {
        "for": 120,
        "against": 35,
        "abstain": 4
      },
      "startTime": "2026-03-01T12:00:00.000Z",
      "endTime": "2026-03-03T12:00:00.000Z"
    }
  ]
}
```

Example tally output (`votes tally`):

```json
{
  "ok": true,
  "data": {
    "proposalId": "42",
    "votesFor": 120,
    "votesAgainst": 35,
    "votesAbstain": 4,
    "totalVotes": 159,
    "breakdown": {
      "for": "75.5%",
      "against": "22.0%",
      "abstain": "2.5%"
    }
  }
}
```

## Error handling

On request failures, commands return structured errors. Example:

```json
{
  "ok": false,
  "error": {
    "code": "FETCH_ERROR",
    "message": "Failed to fetch proposals: ...",
    "retryable": true
  }
}
```
