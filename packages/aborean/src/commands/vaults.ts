import { checksumAddress, isAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import type { Address } from 'viem';

import { ABOREAN_V2_ADDRESSES, ABOREAN_VAULT_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import { asNum, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const relayAbi = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'mTokenId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'keeperLastRun',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const erc20Abi = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const votingEscrowLiteAbi = [
  {
    type: 'function',
    name: 'balanceOfNFT',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const relayRowSchema = z.object({
  label: z.string(),
  relay: z.string(),
  name: z.string(),
  factoryType: z.enum(['autoCompounder', 'autoConverter']),
  managedTokenId: z.string(),
  managedVotingPower: z.string(),
  relayToken: z.object({
    address: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  relayTokenBalance: z.string(),
  keeperLastRun: z.number(),
  keeperLastRunRelative: z.string(),
  secondsSinceKeeperRun: z.number(),
});

type FactoryType = 'autoCompounder' | 'autoConverter';

type KnownRelay = {
  label: string;
  relay: Address;
  factoryType: FactoryType;
};

type VaultRelaySnapshot = z.infer<typeof relayRowSchema>;

export type VaultSummarySnapshot = {
  relayCount: number;
  relays: VaultRelaySnapshot[];
  totals: {
    managedVotingPower: string;
    relayTokenBalances: Array<{
      token: string;
      symbol: string;
      decimals: number;
      balance: string;
    }>;
  };
};

const KNOWN_RELAYS: readonly KnownRelay[] = [
  {
    label: 'veABX Maxi Relay',
    relay: checksumAddress(ABOREAN_VAULT_ADDRESSES.veAbxMaxiRelay) as Address,
    factoryType: 'autoCompounder',
  },
  {
    label: 'ABX Rewards Relay',
    relay: checksumAddress(ABOREAN_VAULT_ADDRESSES.abxRewardsRelay) as Address,
    factoryType: 'autoConverter',
  },
] as const;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function readRelaySnapshot(
  client: ReturnType<typeof createAboreanPublicClient>,
  relay: KnownRelay,
): Promise<VaultRelaySnapshot> {
  const [name, managedTokenId, relayTokenAddress, keeperLastRun] = (await Promise.all([
    client.readContract({
      abi: relayAbi,
      address: relay.relay,
      functionName: 'name',
    }),
    client.readContract({
      abi: relayAbi,
      address: relay.relay,
      functionName: 'mTokenId',
    }),
    client.readContract({
      abi: relayAbi,
      address: relay.relay,
      functionName: 'token',
    }),
    client.readContract({
      abi: relayAbi,
      address: relay.relay,
      functionName: 'keeperLastRun',
    }),
  ])) as [string, bigint, Address, bigint];

  const tokenAddress = checksumAddress(relayTokenAddress) as Address;

  const [symbol, decimals, relayTokenBalance, managedVotingPower] = (await Promise.all([
    client.readContract({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'symbol',
    }),
    client.readContract({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'decimals',
    }),
    client.readContract({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'balanceOf',
      args: [relay.relay] as const,
    }),
    client.readContract({
      abi: votingEscrowLiteAbi,
      address: ABOREAN_V2_ADDRESSES.votingEscrow,
      functionName: 'balanceOfNFT',
      args: [managedTokenId] as const,
    }),
  ])) as [string, number, bigint, bigint];

  const keeperTs = asNum(keeperLastRun);
  const now = Math.floor(Date.now() / 1000);

  return {
    label: relay.label,
    relay: toChecksum(relay.relay),
    name,
    factoryType: relay.factoryType,
    managedTokenId: managedTokenId.toString(),
    managedVotingPower: managedVotingPower.toString(),
    relayToken: {
      address: toChecksum(tokenAddress),
      symbol,
      decimals,
    },
    relayTokenBalance: relayTokenBalance.toString(),
    keeperLastRun: keeperTs,
    keeperLastRunRelative: relTime(keeperLastRun),
    secondsSinceKeeperRun: Math.max(0, now - keeperTs),
  };
}

export async function readVaultSummary(
  client: ReturnType<typeof createAboreanPublicClient>,
): Promise<VaultSummarySnapshot> {
  const relays = await Promise.all(KNOWN_RELAYS.map((relay) => readRelaySnapshot(client, relay)));

  const tokenTotals = new Map<
    string,
    { token: string; symbol: string; decimals: number; balance: bigint }
  >();

  let managedVotingPowerTotal = 0n;

  for (const relay of relays) {
    managedVotingPowerTotal += BigInt(relay.managedVotingPower);

    const key = relay.relayToken.address.toLowerCase();
    const prev = tokenTotals.get(key);
    const balance = BigInt(relay.relayTokenBalance);

    if (prev) {
      prev.balance += balance;
      continue;
    }

    tokenTotals.set(key, {
      token: relay.relayToken.address,
      symbol: relay.relayToken.symbol,
      decimals: relay.relayToken.decimals,
      balance,
    });
  }

  const relayTokenBalances = [...tokenTotals.values()].map((row) => ({
    token: row.token,
    symbol: row.symbol,
    decimals: row.decimals,
    balance: row.balance.toString(),
  }));

  return {
    relayCount: relays.length,
    relays,
    totals: {
      managedVotingPower: managedVotingPowerTotal.toString(),
      relayTokenBalances,
    },
  };
}

export const vaults = Cli.create('vaults', {
  description: 'Inspect Aborean relay vaults (auto-compounder / auto-converter).',
});

vaults.command('list', {
  description: 'List known Aborean relay vaults with keeper and veNFT state.',
  env,
  output: z.object({
    relayCount: z.number(),
    relays: z.array(relayRowSchema),
    totals: z.object({
      managedVotingPower: z.string(),
      relayTokenBalances: z.array(
        z.object({
          token: z.string(),
          symbol: z.string(),
          decimals: z.number(),
          balance: z.string(),
        }),
      ),
    }),
  }),
  examples: [{ description: 'List all known vault relays on Abstract' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const snapshot = await readVaultSummary(client);
    return c.ok(snapshot);
  },
});

vaults.command('relay', {
  description: 'Inspect one relay vault by address.',
  args: z.object({
    relay: z.string().describe('Relay vault contract address'),
  }),
  env,
  output: relayRowSchema,
  examples: [
    {
      args: { relay: ABOREAN_VAULT_ADDRESSES.veAbxMaxiRelay },
      description: 'Inspect the veABX maxi relay',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.relay)) {
      return c.error({
        code: 'INVALID_ARGUMENT',
        message: 'relay must be a valid address',
      });
    }

    const relayAddress = checksumAddress(c.args.relay) as Address;
    const known = KNOWN_RELAYS.find(
      (relay) => relay.relay.toLowerCase() === relayAddress.toLowerCase(),
    );

    if (!known) {
      return c.error({
        code: 'NOT_FOUND',
        message: `relay ${shortAddress(relayAddress)} is not in the known Aborean vault set`,
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const snapshot = await readRelaySnapshot(client, known);
    return c.ok(snapshot);
  },
});
