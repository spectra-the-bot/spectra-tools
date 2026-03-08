import { Cli, z } from 'incur';
import { treasuryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

const env = z.object({ ABSTRACT_RPC_URL: z.string().optional() });
export const treasury = Cli.create('treasury', { description: 'Read treasury state.' });

treasury.command('balance', {
  env,
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
  args: z.object({ asset: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const whitelisted = await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'isAssetWhitelisted',
      args: [c.args.asset],
    });
    return c.ok({ asset: toChecksum(c.args.asset), whitelisted });
  },
});

treasury.command('major-spend-status', {
  env,
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
  args: z.object({ proposalId: z.coerce.number().int().positive() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const executed = await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'executedByProposal',
      args: [BigInt(c.args.proposalId)],
    });
    return c.ok({ proposalId: c.args.proposalId, executed });
  },
});
