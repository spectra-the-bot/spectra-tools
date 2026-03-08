import { Cli, z } from 'incur';
import { treasuryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

export const treasury = Cli.create('treasury', {
  description: 'Inspect treasury balances, execution status, and spend controls.',
});

treasury.command('balance', {
  description: 'Get current native token balance for the treasury contract.',
  env,
  output: z.object({
    address: z.string(),
    balanceWei: z.string(),
    balance: z.string(),
  }),
  examples: [{ description: 'Check treasury balance' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const balance = await client.getBalance({ address: ABSTRACT_MAINNET_ADDRESSES.treasury });
    return c.ok({
      address: toChecksum(ABSTRACT_MAINNET_ADDRESSES.treasury),
      balanceWei: balance.toString(),
      balance: eth(balance),
    });
  },
});

treasury.command('whitelist', {
  description: 'Check whether an asset address is treasury-whitelisted.',
  args: z.object({
    asset: z.string().describe('Token/asset contract address'),
  }),
  env,
  output: z.object({
    asset: z.string(),
    whitelisted: z.boolean(),
  }),
  examples: [
    {
      args: { asset: '0x0000000000000000000000000000000000000000' },
      description: 'Check whitelist status for one asset',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const whitelisted = (await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'isAssetWhitelisted',
      args: [c.args.asset],
    })) as boolean;
    return c.ok({ asset: toChecksum(c.args.asset), whitelisted });
  },
});

treasury.command('major-spend-status', {
  description: 'Read major-spend cooldown status for the treasury contract.',
  env,
  output: z.object({
    majorSpendCooldownSeconds: z.number(),
    lastMajorSpendAt: z.number(),
    lastMajorSpendRelative: z.string(),
    isMajorSpendAllowed: z.boolean(),
  }),
  examples: [{ description: 'Inspect treasury major-spend guardrails' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [cooldown, lastMajorSpendAt, allowed] = (await Promise.all([
      client.readContract({
        abi: treasuryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.treasury,
        functionName: 'majorSpendCooldown',
      }),
      client.readContract({
        abi: treasuryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.treasury,
        functionName: 'lastMajorSpendAt',
        args: [ABSTRACT_MAINNET_ADDRESSES.treasury],
      }),
      client.readContract({
        abi: treasuryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.treasury,
        functionName: 'isMajorSpendAllowed',
        args: [ABSTRACT_MAINNET_ADDRESSES.treasury, 0n],
      }),
    ])) as [bigint, bigint, boolean];
    return c.ok({
      majorSpendCooldownSeconds: asNum(cooldown),
      lastMajorSpendAt: asNum(lastMajorSpendAt),
      lastMajorSpendRelative: relTime(lastMajorSpendAt),
      isMajorSpendAllowed: allowed,
    });
  },
});

treasury.command('executed', {
  description: 'Check whether a treasury action for a proposal has executed.',
  args: z.object({
    proposalId: z.coerce.number().int().positive().describe('Governance proposal id'),
  }),
  env,
  output: z.object({
    proposalId: z.number(),
    executed: z.boolean(),
  }),
  examples: [{ args: { proposalId: 1 }, description: 'Check execution status for proposal #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const executed = (await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'executedByProposal',
      args: [BigInt(c.args.proposalId)],
    })) as boolean;
    return c.ok({ proposalId: c.args.proposalId, executed });
  },
});
