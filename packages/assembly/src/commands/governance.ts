import { Cli, z } from 'incur';
import { governanceAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, relTime } from './_common.js';

const env = z.object({ ABSTRACT_RPC_URL: z.string().optional() });
export const governance = Cli.create('governance', {
  description: 'Read governance proposals and params.',
});

governance.command('proposals', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposalCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const proposals = (
      ids.length
        ? await client.multicall({
            allowFailure: false,
            contracts: ids.map((id) => ({
              abi: governanceAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.governance,
              functionName: 'proposals',
              args: [id] as const,
            })),
          })
        : []
    ) as Array<Record<string, unknown>>;
    return c.ok(
      proposals.map((p, i: number) => ({
        id: i + 1,
        kind: asNum(p.kind as bigint),
        status: asNum(p.status as bigint),
        title: p.title,
        voteEndAt: asNum(p.voteEndAt as bigint),
        voteEndRelative: relTime(p.voteEndAt as bigint),
      })),
      {
        cta: {
          description: 'Inspect or vote:',
          commands: [
            { command: 'governance proposal', args: { id: '<id>' } },
            { command: 'governance vote', args: { id: '<id>' } },
          ],
        },
      },
    );
  },
});

governance.command('proposal', {
  args: z.object({ id: z.coerce.number().int().positive() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const proposal = await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposals',
      args: [BigInt(c.args.id)],
    });
    return c.ok(proposal);
  },
});

governance.command('has-voted', {
  args: z.object({ proposalId: z.coerce.number().int().positive(), address: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const hasVoted = await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'hasVoted',
      args: [BigInt(c.args.proposalId), c.args.address],
    });
    return c.ok({ proposalId: c.args.proposalId, address: c.args.address, hasVoted });
  },
});

governance.command('params', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const getters = [
      'deliberationPeriod',
      'votePeriod',
      'quorumBps',
      'constitutionalDeliberationPeriod',
      'constitutionalVotePeriod',
      'constitutionalPassBps',
      'majorPassBps',
      'parameterPassBps',
      'significantPassBps',
      'significantThresholdBps',
      'routineThresholdBps',
      'timelockPeriod',
    ] as const;
    const values = await client.multicall({
      allowFailure: false,
      contracts: getters.map((name) => ({
        abi: governanceAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.governance,
        functionName: name,
      })),
    });
    return c.ok(Object.fromEntries(getters.map((k, i) => [k, asNum(values[i] as bigint)])));
  },
});
