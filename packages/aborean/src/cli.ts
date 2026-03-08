import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli, z } from 'incur';

import { clFactoryAbi, poolFactoryAbi, voterAbi, votingEscrowAbi } from './contracts/abis.js';
import { ABOREAN_CL_ADDRESSES, ABOREAN_V2_ADDRESSES } from './contracts/addresses.js';
import { createAboreanPublicClient } from './contracts/client.js';
import { applyFriendlyErrorHandling } from './error-handling.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('aborean', {
  version: pkg.version,
  description: 'Aborean Finance DEX CLI for Abstract chain.',
});

const rootEnv = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

cli.command('status', {
  description:
    'Get a cross-contract Aborean protocol snapshot (pool counts, gauge count, veABX supply).',
  env: rootEnv,
  output: z.object({
    v2PoolCount: z.number().describe('Number of V2 AMM pools'),
    clPoolCount: z.number().describe('Number of Slipstream (CL) pools'),
    gaugeCount: z.number().describe('Number of pools with gauges'),
    totalVotingWeight: z.string().describe('Total voting weight (wei)'),
    veABXTotalSupply: z.string().describe('Total veABX supply (wei)'),
    veABXLockedSupply: z.string().describe('Total ABX locked in VotingEscrow (wei)'),
  }),
  examples: [{ description: 'Fetch the current Aborean protocol status' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [
      v2PoolCount,
      clPoolCount,
      gaugeCount,
      totalVotingWeight,
      veABXTotalSupply,
      veABXLockedSupply,
    ] = await Promise.all([
      client.readContract({
        abi: poolFactoryAbi,
        address: ABOREAN_V2_ADDRESSES.poolFactory,
        functionName: 'allPoolsLength',
      }),
      client.readContract({
        abi: clFactoryAbi,
        address: ABOREAN_CL_ADDRESSES.clFactory,
        functionName: 'allPoolsLength',
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'length',
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'totalWeight',
      }),
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'totalSupply',
      }),
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'supply',
      }),
    ]);

    return c.ok({
      v2PoolCount: Number(v2PoolCount),
      clPoolCount: Number(clPoolCount),
      gaugeCount: Number(gaugeCount),
      totalVotingWeight: String(totalVotingWeight),
      veABXTotalSupply: String(veABXTotalSupply),
      veABXLockedSupply: String(veABXLockedSupply),
    });
  },
});

applyFriendlyErrorHandling(cli);
cli.serve();

export { cli };
