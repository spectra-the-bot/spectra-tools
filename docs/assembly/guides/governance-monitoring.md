# Guide: Governance Monitoring

This guide shows a practical Assembly monitoring loop using `assembly-cli`.

Use this flow when you want to:
- track newly created proposals
- check proposal vote windows and status changes
- monitor current council seat occupancy

## 1) Check global system status

Start with a high-level snapshot:

```bash
assembly-cli status
```

For machine pipelines:

```bash
assembly-cli status --format json
```

## 2) Track proposal feed

List proposals and watch their status:

```bash
assembly-cli governance proposals
assembly-cli governance proposals --format json
```

Useful filtered view:

```bash
assembly-cli governance proposals --format json --filter-output proposals
```

## 3) Drill into a proposal

Inspect one proposal in detail (timing + vote counts + status):

```bash
assembly-cli governance proposal 42
assembly-cli governance proposal 42 --format json --verbose
```

Common fields to watch over time:
- `status`
- `forVotes`
- `againstVotes`
- `abstainVotes`
- `voteEndAt`
- `timelockEndsAt`

## 4) Check whether a specific voter has voted

```bash
assembly-cli governance has-voted 42 0xYourAddress
```

This is useful for participation tracking dashboards.

## 5) Monitor council seats

Watch seat occupancy and active council members:

```bash
assembly-cli council seats
assembly-cli council members
```

For automation:

```bash
assembly-cli council seats --format json
assembly-cli council members --format json
```

## 6) Optional: verify treasury execution for passed proposals

```bash
assembly-cli treasury executed 42
```

This helps confirm whether treasury-linked actions have been executed after governance completion.

## Suggested monitoring cadence

- **Every few minutes**: `governance proposals`
- **On status change**: `governance proposal <id>`
- **Daily/slot-based**: `council seats`, `council members`

## Related docs

- [Assembly overview](/assembly/)
- [Assembly configuration](/assembly/configuration)
- [Assembly command reference](/assembly/commands)
