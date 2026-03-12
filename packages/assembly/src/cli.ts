import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initTelemetry,
  shutdownTelemetry,
  withCommandSpan,
} from '@spectratools/cli-shared/telemetry';
import { Cli, z } from 'incur';
import { eth, relTime, timeValue, toChecksum } from './commands/_common.js';
import { council } from './commands/council.js';
import { registerDigestCommand } from './commands/digest.js';
import { forum } from './commands/forum.js';
import { governance } from './commands/governance.js';
import { members } from './commands/members.js';
import { seats } from './commands/seats.js';
import { treasury } from './commands/treasury.js';
import { councilSeatsAbi, governanceAbi, registryAbi } from './contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from './contracts/addresses.js';
import { createAssemblyPublicClient } from './contracts/client.js';
import { applyFriendlyErrorHandling } from './error-handling.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('assembly', {
  version: pkg.version,
  description: 'Assembly governance CLI for Abstract chain.',
});

cli.command(members);
cli.command(council);
cli.command(seats);
cli.command(forum);
cli.command(governance);
cli.command(treasury);
registerDigestCommand(cli);

const rootEnv = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const timestampOutput = z.union([z.number(), z.string()]);

cli.command('status', {
  description: 'Get a cross-contract Assembly snapshot (members, council, governance, treasury).',
  env: rootEnv,
  output: z.object({
    activeMemberCount: z.number(),
    seatCount: z.number(),
    proposalCount: z.number(),
    currentAuctionDay: z.number(),
    currentAuctionSlot: z.number(),
    treasuryBalance: z.string(),
  }),
  examples: [{ description: 'Fetch the current Assembly system status' }],
  async run(c) {
    return withCommandSpan('assembly status', {}, async () => {
      const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
      const [
        activeMemberCount,
        seatCount,
        proposalCount,
        currentAuctionDay,
        currentAuctionSlot,
        treasuryBalance,
      ] = await Promise.all([
        client.readContract({
          abi: registryAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.registry,
          functionName: 'activeMemberCount',
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'seatCount',
        }),
        client.readContract({
          abi: governanceAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.governance,
          functionName: 'proposalCount',
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'currentAuctionDay',
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'currentAuctionSlot',
        }),
        client.getBalance({ address: ABSTRACT_MAINNET_ADDRESSES.treasury }),
      ]);
      return c.ok({
        activeMemberCount: Number(activeMemberCount),
        seatCount: Number(seatCount),
        proposalCount: Number(proposalCount),
        currentAuctionDay: Number(currentAuctionDay),
        currentAuctionSlot: Number(currentAuctionSlot),
        treasuryBalance: eth(treasuryBalance),
      });
    });
  },
});

cli.command('health', {
  description: 'Check cross-contract health for one address (membership, council, refunds, power).',
  args: z.object({
    address: z.string().describe('Member or wallet address to inspect'),
  }),
  env: rootEnv,
  output: z.object({
    address: z.string(),
    isActive: z.boolean(),
    activeUntil: timestampOutput,
    activeUntilRelative: z.string(),
    isCouncilMember: z.boolean(),
    pendingReturnsWei: z.string(),
    votingPower: z.number(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'Inspect one address across Assembly contracts',
    },
  ],
  async run(c) {
    return withCommandSpan('assembly health', { address: c.args.address }, async () => {
      const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
      const [isActive, member, isCouncilMember, pendingReturns, votingPower] = (await Promise.all([
        client.readContract({
          abi: registryAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.registry,
          functionName: 'isActive',
          args: [c.args.address],
        }),
        client.readContract({
          abi: registryAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.registry,
          functionName: 'members',
          args: [c.args.address],
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'isCouncilMember',
          args: [c.args.address],
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'pendingReturns',
          args: [c.args.address],
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'getVotingPower',
          args: [c.args.address],
        }),
      ])) as [boolean, { activeUntil: bigint }, boolean, bigint, bigint];
      return c.ok({
        address: toChecksum(c.args.address),
        isActive,
        activeUntil: timeValue(member.activeUntil, c.format),
        activeUntilRelative: relTime(member.activeUntil),
        isCouncilMember,
        pendingReturnsWei: pendingReturns.toString(),
        votingPower: Number(votingPower),
      });
    });
  },
});

applyFriendlyErrorHandling(cli);

export { cli };

const isMain = (() => {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  initTelemetry('assembly');
  process.on('beforeExit', () => shutdownTelemetry());
  cli.serve();
}
