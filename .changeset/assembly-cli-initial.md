---
'@spectra-the-bot/assembly-cli': minor
---

Initial release of `@spectra-the-bot/assembly-cli`.

Implements the Assembly governance CLI for Abstract chain with the following command groups:

- `proposals list/get/vote` — list, inspect, and vote on governance proposals
- `council members/info/seats` — explore council members and seat status
- `forum posts/post/search` — browse the Assembly governance forum
- `members list/info/status` — inspect Assembly membership and voting power
- `votes history/tally` — view voting history and proposal tallies

Built on the `incur` framework with typed Zod schemas, CTAs, and support for `ASSEMBLY_API_KEY` and `ABSTRACT_RPC_URL` environment variables.
