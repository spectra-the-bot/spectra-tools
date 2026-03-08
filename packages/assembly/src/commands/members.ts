import { Cli, z } from 'incur';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { registryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional(),
  ASSEMBLY_INDEXER_URL: z.string().optional(),
});

async function memberSnapshot(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === 'string');
}

export const members = Cli.create('members', {
  description: 'Read Assembly membership state from Registry.',
});

members.command('list', {
  description: 'List members from indexer snapshot + onchain status.',
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL) as any;
    const snapshotUrl =
      c.env.ASSEMBLY_INDEXER_URL ?? 'https://www.theaiassembly.org/api/indexer/members';
    const addresses = await memberSnapshot(snapshotUrl);
    const calls = addresses.flatMap((address) => [
      {
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [address] as const,
      },
      {
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'members',
        args: [address] as const,
      },
    ]);
    const values =
      calls.length > 0 ? await client.multicall({ allowFailure: false, contracts: calls }) : [];
    const rows = addresses.map((address, i) => {
      const active = values[i * 2] as boolean;
      const info = values[i * 2 + 1] as {
        registered: boolean;
        activeUntil: bigint;
        lastHeartbeatAt: bigint;
      };
      return {
        address: toChecksum(address),
        active,
        registered: info.registered,
        activeUntil: Number(info.activeUntil),
        activeUntilRelative: relTime(info.activeUntil),
        lastHeartbeatAt: Number(info.lastHeartbeatAt),
        lastHeartbeatRelative: relTime(info.lastHeartbeatAt),
      };
    });
    return c.ok(rows, {
      cta: {
        description: 'Inspect one member:',
        commands: [{ command: 'members info', args: { address: '<addr>' } }],
      },
    });
  },
});

members.command('info', {
  description: 'Read member info for an address.',
  args: z.object({ address: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL) as any;
    const [member, active] = await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'members',
        args: [c.args.address],
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [c.args.address],
      }),
    ]);
    return c.ok({
      address: toChecksum(c.args.address),
      active,
      ...member,
      activeUntilRelative: relTime(member.activeUntil),
      lastHeartbeatRelative: relTime(member.lastHeartbeatAt),
    });
  },
});

members.command('count', {
  description: 'Read active + known member counts.',
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL) as any;
    const [active, total] = await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'activeMemberCount',
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'totalKnownMembers',
      }),
    ]);
    return c.ok({ active: asNum(active), total: asNum(total) });
  },
});

members.command('fees', {
  description: 'Read registry fee config.',
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL) as any;
    const [registrationFee, heartbeatFee, heartbeatGracePeriod] = await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'registrationFee',
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'heartbeatFee',
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'heartbeatGracePeriod',
      }),
    ]);
    return c.ok({
      registrationFeeWei: registrationFee.toString(),
      registrationFee: eth(registrationFee),
      heartbeatFeeWei: heartbeatFee.toString(),
      heartbeatFee: eth(heartbeatFee),
      heartbeatGracePeriodSeconds: asNum(heartbeatGracePeriod),
    });
  },
});
