import { Cli, z } from 'incur';
import type { Address } from 'viem';

import { votingEscrowAbi } from '../contracts/abis.js';
import { ABOREAN_V2_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import { asNum, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

type LockedBalance = {
  amount: bigint;
  end: bigint;
  isPermanent: boolean;
};

type GlobalPoint = {
  bias: bigint;
  slope: bigint;
  ts: bigint;
  blk: bigint;
  permanentLockBalance: bigint;
};

export const ve = Cli.create('ve', {
  description: 'Inspect Aborean VotingEscrow (veABX) global and per-NFT lock state.',
});

ve.command('stats', {
  description: 'Get global VotingEscrow supply, locks, and decay checkpoint data.',
  env,
  output: z.object({
    token: z.string(),
    totalVotingPower: z.string(),
    totalLocked: z.string(),
    permanentLocked: z.string(),
    epoch: z.number(),
    decayBias: z.string(),
    decaySlope: z.string(),
    lastCheckpointTimestamp: z.number(),
    lastCheckpointBlock: z.number(),
  }),
  examples: [{ description: 'Show global veABX state and decay metrics' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [token, totalVotingPower, totalLocked, permanentLocked, epoch] = (await Promise.all([
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'token',
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
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'permanentLockBalance',
      }),
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'epoch',
      }),
    ])) as [Address, bigint, bigint, bigint, bigint];

    const point = (await client.readContract({
      abi: votingEscrowAbi,
      address: ABOREAN_V2_ADDRESSES.votingEscrow,
      functionName: 'pointHistory',
      args: [epoch],
    })) as GlobalPoint;

    return c.ok({
      token: toChecksum(token),
      totalVotingPower: totalVotingPower.toString(),
      totalLocked: totalLocked.toString(),
      permanentLocked: permanentLocked.toString(),
      epoch: asNum(epoch),
      decayBias: point.bias.toString(),
      decaySlope: point.slope.toString(),
      lastCheckpointTimestamp: asNum(point.ts),
      lastCheckpointBlock: asNum(point.blk),
    });
  },
});

ve.command('lock', {
  description: 'Get lock details and voting power for one veNFT token id.',
  args: z.object({
    tokenId: z.coerce.number().int().nonnegative().describe('veNFT token id'),
  }),
  env,
  output: z.object({
    tokenId: z.number(),
    owner: z.string(),
    amount: z.string(),
    unlockTime: z.number(),
    isPermanent: z.boolean(),
    votingPower: z.string(),
  }),
  examples: [{ args: { tokenId: 1 }, description: 'Inspect lock details for veNFT #1' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const tokenId = BigInt(c.args.tokenId);

    const [owner, locked, votingPower] = (await Promise.all([
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'ownerOf',
        args: [tokenId],
      }),
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'locked',
        args: [tokenId],
      }),
      client.readContract({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'balanceOfNFT',
        args: [tokenId],
      }),
    ])) as [Address, LockedBalance, bigint];

    return c.ok({
      tokenId: c.args.tokenId,
      owner: toChecksum(owner),
      amount: locked.amount.toString(),
      unlockTime: asNum(locked.end),
      isPermanent: locked.isPermanent,
      votingPower: votingPower.toString(),
    });
  },
});

ve.command('locks', {
  description: 'List all veNFT locks owned by an address.',
  args: z.object({
    address: z.string().describe('Owner address'),
  }),
  env,
  output: z.object({
    address: z.string(),
    locks: z.array(
      z.object({
        tokenId: z.string(),
        amount: z.string(),
        unlockTime: z.number(),
        isPermanent: z.boolean(),
        votingPower: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'List all veNFT locks for an address',
    },
  ],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const balance = (await client.readContract({
      abi: votingEscrowAbi,
      address: ABOREAN_V2_ADDRESSES.votingEscrow,
      functionName: 'balanceOf',
      args: [c.args.address as Address],
    })) as bigint;

    const count = asNum(balance);
    if (!count) {
      return c.ok({
        address: toChecksum(c.args.address),
        locks: [],
        count: 0,
      });
    }

    const indices = Array.from({ length: count }, (_, i) => BigInt(i));

    const tokenIds = (await client.multicall({
      allowFailure: false,
      contracts: indices.map((index) => ({
        abi: votingEscrowAbi,
        address: ABOREAN_V2_ADDRESSES.votingEscrow,
        functionName: 'tokenOfOwnerByIndex',
        args: [c.args.address as Address, index] as const,
      })),
    })) as bigint[];

    const lockData = (await client.multicall({
      allowFailure: false,
      contracts: tokenIds.flatMap((tokenId) => [
        {
          abi: votingEscrowAbi,
          address: ABOREAN_V2_ADDRESSES.votingEscrow,
          functionName: 'locked',
          args: [tokenId] as const,
        },
        {
          abi: votingEscrowAbi,
          address: ABOREAN_V2_ADDRESSES.votingEscrow,
          functionName: 'balanceOfNFT',
          args: [tokenId] as const,
        },
      ]),
    })) as Array<LockedBalance | bigint>;

    const locks = tokenIds.map((tokenId, index) => {
      const offset = index * 2;
      const locked = lockData[offset] as LockedBalance;
      const votingPower = lockData[offset + 1] as bigint;

      return {
        tokenId: tokenId.toString(),
        amount: locked.amount.toString(),
        unlockTime: asNum(locked.end),
        isPermanent: locked.isPermanent,
        votingPower: votingPower.toString(),
      };
    });

    return c.ok({
      address: toChecksum(c.args.address),
      locks,
      count: locks.length,
    });
  },
});

ve.command('voting-power', {
  description: 'Get current voting power for one veNFT token id.',
  args: z.object({
    tokenId: z.coerce.number().int().nonnegative().describe('veNFT token id'),
  }),
  env,
  output: z.object({
    tokenId: z.number(),
    votingPower: z.string(),
  }),
  examples: [{ args: { tokenId: 1 }, description: 'Get current voting power for veNFT #1' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const votingPower = (await client.readContract({
      abi: votingEscrowAbi,
      address: ABOREAN_V2_ADDRESSES.votingEscrow,
      functionName: 'balanceOfNFT',
      args: [BigInt(c.args.tokenId)],
    })) as bigint;

    return c.ok({
      tokenId: c.args.tokenId,
      votingPower: votingPower.toString(),
    });
  },
});
