import { Cli, z } from 'incur';
import { councilSeatsAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

type SeatTuple = readonly [string, bigint, bigint, boolean];
type AuctionTuple = readonly [string, bigint, boolean];

function decodeSeat(value: unknown): {
  owner: string;
  startAt: bigint;
  endAt: bigint;
  forfeited: boolean;
} {
  const [owner, startAt, endAt, forfeited] = value as SeatTuple;
  return { owner, startAt, endAt, forfeited };
}

function decodeAuction(value: unknown): {
  highestBidder: string;
  highestBid: bigint;
  settled: boolean;
} {
  const [highestBidder, highestBid, settled] = value as AuctionTuple;
  return { highestBidder, highestBid, settled };
}

export const council = Cli.create('council', {
  description: 'Inspect council seats, members, auctions, and seat parameters.',
});

council.command('seats', {
  description: 'List all council seats and their occupancy windows.',
  env,
  output: z.array(
    z.object({
      id: z.number(),
      owner: z.string(),
      startAt: z.number(),
      startAtRelative: z.string(),
      endAt: z.number(),
      endAtRelative: z.string(),
      forfeited: z.boolean(),
    }),
  ),
  examples: [{ description: 'List all council seats' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seatCount',
    })) as bigint;
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
    const seatTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: councilSeatsAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
            functionName: 'seats',
            args: [id] as const,
          })),
        })
      : [];
    const seats = (seatTuples as unknown[]).map(decodeSeat);

    return c.ok(
      seats.map((seat, idx: number) => ({
        id: idx,
        owner: toChecksum(seat.owner),
        startAt: asNum(seat.startAt),
        startAtRelative: relTime(seat.startAt),
        endAt: asNum(seat.endAt),
        endAtRelative: relTime(seat.endAt),
        forfeited: seat.forfeited,
      })),
    );
  },
});

council.command('seat', {
  description: 'Get detailed seat information for a specific seat id.',
  args: z.object({
    id: z.coerce.number().int().nonnegative().describe('Seat id (0-indexed)'),
  }),
  env,
  output: z.object({
    id: z.number(),
    owner: z.string(),
    startAt: z.number(),
    endAt: z.number(),
    forfeited: z.boolean(),
    endAtRelative: z.string(),
  }),
  examples: [{ args: { id: 0 }, description: 'Inspect seat #0' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const seatTuple = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seats',
      args: [BigInt(c.args.id)],
    });
    const seat = decodeSeat(seatTuple);

    return c.ok({
      id: c.args.id,
      owner: toChecksum(seat.owner),
      startAt: asNum(seat.startAt),
      endAt: asNum(seat.endAt),
      forfeited: seat.forfeited,
      endAtRelative: relTime(seat.endAt),
    });
  },
});

council.command('members', {
  description: 'List currently active council members and voting power.',
  env,
  output: z.array(
    z.object({
      address: z.string(),
      votingPower: z.number(),
    }),
  ),
  examples: [{ description: 'List active council members' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seatCount',
    })) as bigint;
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
    const seatTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: councilSeatsAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
            functionName: 'seats',
            args: [id] as const,
          })),
        })
      : [];
    const seats = (seatTuples as unknown[]).map(decodeSeat);

    const activeOwners = [
      ...new Set(
        seats
          .filter((x) => !x.forfeited && asNum(x.endAt) > Math.floor(Date.now() / 1000))
          .map((x) => x.owner),
      ),
    ];
    const powers = activeOwners.length
      ? await client.multicall({
          allowFailure: false,
          contracts: activeOwners.map((owner) => ({
            abi: councilSeatsAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
            functionName: 'getVotingPower',
            args: [owner] as const,
          })),
        })
      : [];
    return c.ok(
      activeOwners.map((owner, i) => ({
        address: toChecksum(owner),
        votingPower: asNum(powers[i] as bigint),
      })),
    );
  },
});

council.command('is-member', {
  description: 'Check whether an address is currently a council member.',
  args: z.object({
    address: z.string().describe('Address to check'),
  }),
  env,
  output: z.object({
    address: z.string(),
    isMember: z.boolean(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'Check council status for one address',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const isMember = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'isCouncilMember',
      args: [c.args.address],
    })) as boolean;
    return c.ok({ address: toChecksum(c.args.address), isMember });
  },
});

council.command('voting-power', {
  description: 'Get the current voting power for an address.',
  args: z.object({
    address: z.string().describe('Address to inspect'),
  }),
  env,
  output: z.object({
    address: z.string(),
    votingPower: z.number(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'Get voting power for one address',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const votingPower = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'getVotingPower',
      args: [c.args.address],
    })) as bigint;
    return c.ok({ address: toChecksum(c.args.address), votingPower: asNum(votingPower) });
  },
});

council.command('auctions', {
  description: 'List recent and current council auction slots and leading bids.',
  env,
  output: z.object({
    currentDay: z.number(),
    currentSlot: z.number(),
    auctions: z.array(
      z.object({
        day: z.number(),
        slot: z.number(),
        highestBidder: z.string(),
        highestBid: z.string(),
        settled: z.boolean(),
      }),
    ),
  }),
  examples: [{ description: 'Inspect current and recent auction slots' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [day, slot, slotsPerDay] = (await Promise.all([
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
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'AUCTION_SLOTS_PER_DAY',
      }),
    ])) as [bigint, bigint, bigint];
    const recent: Array<{ day: bigint; slot: number }> = [];
    for (let d = Number(day) - 1; d <= Number(day); d++) {
      if (d < 0) continue;
      for (let s = 0; s < Number(slotsPerDay); s++) recent.push({ day: BigInt(d), slot: s });
    }

    const auctionTuples = recent.length
      ? await client.multicall({
          allowFailure: false,
          contracts: recent.map((x) => ({
            abi: councilSeatsAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
            functionName: 'auctions',
            args: [x.day, x.slot] as const,
          })),
        })
      : [];
    const auctions = (auctionTuples as unknown[]).map(decodeAuction);

    return c.ok(
      {
        currentDay: asNum(day),
        currentSlot: asNum(slot),
        auctions: recent.map((x, i) => ({
          day: Number(x.day),
          slot: x.slot,
          highestBidder: toChecksum(auctions[i].highestBidder),
          highestBid: eth(auctions[i].highestBid),
          settled: auctions[i].settled,
        })),
      },
      {
        cta: {
          description: 'Inspect and bid:',
          commands: [
            { command: 'council auction', args: { day: '<day>', slot: '<slot>' } },
            { command: 'council bid', args: { day: '<day>', slot: '<slot>' } },
          ],
        },
      },
    );
  },
});

council.command('auction', {
  description: 'Get one auction slot by day + slot.',
  args: z.object({
    day: z.coerce.number().int().nonnegative().describe('Auction day index'),
    slot: z.coerce.number().int().nonnegative().describe('Slot index within day'),
  }),
  env,
  output: z.object({
    day: z.number(),
    slot: z.number(),
    highestBidder: z.string(),
    highestBid: z.string(),
    settled: z.boolean(),
  }),
  examples: [{ args: { day: 0, slot: 0 }, description: 'Inspect day 0, slot 0 auction' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const auctionTuple = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'auctions',
      args: [BigInt(c.args.day), c.args.slot],
    });
    const auction = decodeAuction(auctionTuple);

    return c.ok({
      day: c.args.day,
      slot: c.args.slot,
      highestBidder: toChecksum(auction.highestBidder),
      highestBid: eth(auction.highestBid),
      settled: auction.settled,
    });
  },
});

council.command('pending-refund', {
  description: 'Get pending refundable bid amount for an address.',
  args: z.object({
    address: z.string().describe('Bidder address'),
  }),
  env,
  output: z.object({
    address: z.string(),
    pendingRefund: z.string(),
    pendingRefundWei: z.string(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'Check pending refund for an address',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const amount = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'pendingReturns',
      args: [c.args.address],
    })) as bigint;
    return c.ok({
      address: toChecksum(c.args.address),
      pendingRefund: eth(amount),
      pendingRefundWei: amount.toString(),
    });
  },
});

council.command('params', {
  description: 'Read council seat term and auction scheduling parameters.',
  env,
  output: z.object({
    SEAT_TERM: z.number(),
    AUCTION_SLOT_DURATION: z.number(),
    AUCTION_SLOTS_PER_DAY: z.number(),
    auctionEpochStart: z.number(),
    auctionWindowStart: z.number(),
    auctionWindowEnd: z.number(),
  }),
  examples: [{ description: 'Inspect council seat + auction timing constants' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [SEAT_TERM, AUCTION_SLOT_DURATION, AUCTION_SLOTS_PER_DAY, auctionEpochStart] =
      (await Promise.all([
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'SEAT_TERM',
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'AUCTION_SLOT_DURATION',
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'AUCTION_SLOTS_PER_DAY',
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'auctionEpochStart',
        }),
      ])) as [bigint, bigint, bigint, bigint];
    const [auctionWindowStart, auctionWindowEnd] = (await Promise.all([
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctionWindowStart',
        args: [0n, 0],
      }),
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctionWindowEnd',
        args: [0n, 0],
      }),
    ])) as [bigint, bigint];
    return c.ok({
      SEAT_TERM: asNum(SEAT_TERM),
      AUCTION_SLOT_DURATION: asNum(AUCTION_SLOT_DURATION),
      AUCTION_SLOTS_PER_DAY: asNum(AUCTION_SLOTS_PER_DAY),
      auctionEpochStart: asNum(auctionEpochStart),
      auctionWindowStart: asNum(auctionWindowStart),
      auctionWindowEnd: asNum(auctionWindowEnd),
    });
  },
});
