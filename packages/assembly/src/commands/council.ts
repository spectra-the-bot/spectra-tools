import { Cli, z } from 'incur';
import { parseEther } from 'viem';
import { councilSeatsAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, timeValue, toChecksum } from './_common.js';
import {
  type FormattedDryRunResult,
  type FormattedTxResult,
  assemblyWriteTx,
  resolveAccount,
  writeEnv,
  writeOptions,
} from './_write-utils.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

type SeatTuple = readonly [string, bigint, bigint, boolean];
type AuctionTuple = readonly [string, bigint, boolean];
type AuctionStatus = 'bidding' | 'closed' | 'settled';

const timestampOutput = z.union([z.number(), z.string()]);

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

function deriveAuctionStatus(params: {
  settled: boolean;
  windowEnd: bigint;
  currentTimestamp: bigint;
}): AuctionStatus {
  if (params.settled) return 'settled';
  if (params.currentTimestamp < params.windowEnd) return 'bidding';
  return 'closed';
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
      startAt: timestampOutput,
      startAtRelative: z.string(),
      endAt: timestampOutput,
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
        startAt: timeValue(seat.startAt, c.format),
        startAtRelative: relTime(seat.startAt),
        endAt: timeValue(seat.endAt, c.format),
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
    startAt: timestampOutput,
    endAt: timestampOutput,
    forfeited: z.boolean(),
    endAtRelative: z.string(),
  }),
  examples: [{ args: { id: 0 }, description: 'Inspect seat #0' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const seatCount = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seatCount',
    })) as bigint;

    if (c.args.id >= Number(seatCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Seat id ${c.args.id} does not exist (seatCount: ${seatCount})`,
        retryable: false,
      });
    }

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
      startAt: timeValue(seat.startAt, c.format),
      endAt: timeValue(seat.endAt, c.format),
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
        windowEnd: timestampOutput,
        windowEndRelative: z.string(),
        status: z.enum(['bidding', 'closed', 'settled']),
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

    const [auctionTuples, windowEnds, latestBlock] = await Promise.all([
      recent.length
        ? client.multicall({
            allowFailure: false,
            contracts: recent.map((x) => ({
              abi: councilSeatsAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
              functionName: 'auctions',
              args: [x.day, x.slot] as const,
            })),
          })
        : Promise.resolve([]),
      recent.length
        ? client.multicall({
            allowFailure: false,
            contracts: recent.map((x) => ({
              abi: councilSeatsAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
              functionName: 'auctionWindowEnd',
              args: [x.day, x.slot] as const,
            })),
          })
        : Promise.resolve([]),
      client.getBlock({ blockTag: 'latest' }),
    ]);
    const auctions = (auctionTuples as unknown[]).map(decodeAuction);
    const currentTimestamp = (latestBlock as { timestamp: bigint }).timestamp;

    return c.ok(
      {
        currentDay: asNum(day),
        currentSlot: asNum(slot),
        auctions: recent.map((x, i) => {
          const windowEnd = windowEnds[i] as bigint;
          return {
            day: Number(x.day),
            slot: x.slot,
            highestBidder: toChecksum(auctions[i].highestBidder),
            highestBid: eth(auctions[i].highestBid),
            settled: auctions[i].settled,
            windowEnd: timeValue(windowEnd, c.format),
            windowEndRelative: relTime(windowEnd),
            status: deriveAuctionStatus({
              settled: auctions[i].settled,
              windowEnd,
              currentTimestamp,
            }),
          };
        }),
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
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
    windowEnd: timestampOutput,
    windowEndRelative: z.string(),
    status: z.enum(['bidding', 'closed', 'settled']),
  }),
  examples: [{ args: { day: 0, slot: 0 }, description: 'Inspect day 0, slot 0 auction' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const slotsPerDay = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'AUCTION_SLOTS_PER_DAY',
    })) as bigint;

    if (c.args.slot >= Number(slotsPerDay)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Slot ${c.args.slot} does not exist (max: ${Number(slotsPerDay) - 1})`,
        retryable: false,
      });
    }

    const [auctionTuple, windowEnd, latestBlock] = await Promise.all([
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctions',
        args: [BigInt(c.args.day), c.args.slot],
      }),
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctionWindowEnd',
        args: [BigInt(c.args.day), c.args.slot],
      }),
      client.getBlock({ blockTag: 'latest' }),
    ]);
    const auction = decodeAuction(auctionTuple);
    const windowEndTimestamp = windowEnd as bigint;
    const currentTimestamp = (latestBlock as { timestamp: bigint }).timestamp;

    return c.ok({
      day: c.args.day,
      slot: c.args.slot,
      highestBidder: toChecksum(auction.highestBidder),
      highestBid: eth(auction.highestBid),
      settled: auction.settled,
      windowEnd: timeValue(windowEndTimestamp, c.format),
      windowEndRelative: relTime(windowEndTimestamp),
      status: deriveAuctionStatus({
        settled: auction.settled,
        windowEnd: windowEndTimestamp,
        currentTimestamp,
      }),
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

// ---------------------------------------------------------------------------
// Write commands
// ---------------------------------------------------------------------------

const txResultOutput = z.union([
  z.object({
    status: z.enum(['success', 'reverted']),
    hash: z.string(),
    blockNumber: z.number(),
    gasUsed: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    effectiveGasPrice: z.string().optional(),
  }),
  z.object({
    status: z.literal('dry-run'),
    estimatedGas: z.string(),
    simulationResult: z.unknown(),
  }),
]);

council.command('bid', {
  description: 'Place a bid on a council seat auction (payable).',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    day: z.coerce.number().int().nonnegative().describe('Auction day index'),
    slot: z.coerce.number().int().nonnegative().describe('Slot index within day'),
  }),
  options: writeOptions.extend({
    amount: z.string().describe('ETH amount to bid (e.g. "0.1")'),
  }),
  env: writeEnv,
  output: z.object({
    day: z.number(),
    slot: z.number(),
    bidAmount: z.string(),
    tx: txResultOutput,
  }),
  examples: [
    {
      args: { day: 0, slot: 0 },
      options: { amount: '0.1' },
      description: 'Bid 0.1 ETH on day 0, slot 0',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);

    // --- Parse amount ---
    let amountWei: bigint;
    try {
      amountWei = parseEther(c.options.amount);
    } catch {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: `Invalid ETH amount: "${c.options.amount}". Provide a decimal number (e.g. "0.1").`,
        retryable: false,
      });
    }
    if (amountWei <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'Bid amount must be greater than zero.',
        retryable: false,
      });
    }

    // --- Pre-flight: validate slot range ---
    const slotsPerDay = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'AUCTION_SLOTS_PER_DAY',
    })) as bigint;
    if (c.args.slot >= Number(slotsPerDay)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Slot ${c.args.slot} does not exist (max: ${Number(slotsPerDay) - 1})`,
        retryable: false,
      });
    }

    // --- Pre-flight: read auction status ---
    const [auctionTuple, windowEnd, latestBlock] = await Promise.all([
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctions',
        args: [BigInt(c.args.day), c.args.slot],
      }),
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctionWindowEnd',
        args: [BigInt(c.args.day), c.args.slot],
      }),
      client.getBlock({ blockTag: 'latest' }),
    ]);
    const auction = decodeAuction(auctionTuple);
    const windowEndTimestamp = windowEnd as bigint;
    const currentTimestamp = (latestBlock as { timestamp: bigint }).timestamp;
    const status = deriveAuctionStatus({
      settled: auction.settled,
      windowEnd: windowEndTimestamp,
      currentTimestamp,
    });

    if (status === 'settled') {
      return c.error({
        code: 'AUCTION_SETTLED',
        message: `Auction (day=${c.args.day}, slot=${c.args.slot}) is already settled. Winner: ${toChecksum(auction.highestBidder)}.`,
        retryable: false,
      });
    }
    if (status === 'closed') {
      return c.error({
        code: 'AUCTION_CLOSED',
        message: `Auction (day=${c.args.day}, slot=${c.args.slot}) bidding window has ended. Use "council settle" instead.`,
        retryable: false,
      });
    }

    if (auction.highestBid >= amountWei) {
      return c.error({
        code: 'BID_TOO_LOW',
        message: `Bid of ${c.options.amount} ETH is not higher than current highest bid of ${eth(auction.highestBid)}. Increase your bid amount.`,
        retryable: false,
      });
    }

    // --- Execute bid ---
    const txResult = await assemblyWriteTx({
      env: c.env,
      options: c.options,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      abi: councilSeatsAbi,
      functionName: 'bid',
      args: [BigInt(c.args.day), c.args.slot],
      value: amountWei,
    });

    return c.ok(
      {
        day: c.args.day,
        slot: c.args.slot,
        bidAmount: `${c.options.amount} ETH`,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Next steps:',
              commands: [
                {
                  command: 'council auction',
                  args: { day: String(c.args.day), slot: String(c.args.slot) },
                  description: 'Check auction status',
                },
              ],
            },
          },
    );
  },
});

council.command('settle', {
  description: 'Settle a completed council seat auction.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    day: z.coerce.number().int().nonnegative().describe('Auction day index'),
    slot: z.coerce.number().int().nonnegative().describe('Slot index within day'),
  }),
  options: writeOptions,
  env: writeEnv,
  output: z.object({
    day: z.number(),
    slot: z.number(),
    highestBidder: z.string(),
    highestBid: z.string(),
    tx: txResultOutput,
  }),
  examples: [
    {
      args: { day: 0, slot: 0 },
      description: 'Settle the auction for day 0, slot 0',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);

    // --- Pre-flight: validate slot range ---
    const slotsPerDay = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'AUCTION_SLOTS_PER_DAY',
    })) as bigint;
    if (c.args.slot >= Number(slotsPerDay)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Slot ${c.args.slot} does not exist (max: ${Number(slotsPerDay) - 1})`,
        retryable: false,
      });
    }

    // --- Pre-flight: read auction status ---
    const [auctionTuple, windowEnd, latestBlock] = await Promise.all([
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctions',
        args: [BigInt(c.args.day), c.args.slot],
      }),
      client.readContract({
        abi: councilSeatsAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
        functionName: 'auctionWindowEnd',
        args: [BigInt(c.args.day), c.args.slot],
      }),
      client.getBlock({ blockTag: 'latest' }),
    ]);
    const auction = decodeAuction(auctionTuple);
    const windowEndTimestamp = windowEnd as bigint;
    const currentTimestamp = (latestBlock as { timestamp: bigint }).timestamp;
    const status = deriveAuctionStatus({
      settled: auction.settled,
      windowEnd: windowEndTimestamp,
      currentTimestamp,
    });

    if (status === 'settled') {
      return c.error({
        code: 'ALREADY_SETTLED',
        message: `Auction (day=${c.args.day}, slot=${c.args.slot}) is already settled.`,
        retryable: false,
      });
    }
    if (status === 'bidding') {
      return c.error({
        code: 'AUCTION_STILL_ACTIVE',
        message: `Auction (day=${c.args.day}, slot=${c.args.slot}) is still accepting bids. Window ends ${relTime(windowEndTimestamp)}.`,
        retryable: false,
      });
    }

    // --- Execute settle ---
    const txResult = await assemblyWriteTx({
      env: c.env,
      options: c.options,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      abi: councilSeatsAbi,
      functionName: 'settleAuction',
      args: [BigInt(c.args.day), c.args.slot],
    });

    return c.ok(
      {
        day: c.args.day,
        slot: c.args.slot,
        highestBidder: toChecksum(auction.highestBidder),
        highestBid: eth(auction.highestBid),
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Next steps:',
              commands: [
                {
                  command: 'council seats',
                  description: 'View updated council seats',
                },
              ],
            },
          },
    );
  },
});

council.command('withdraw-refund', {
  description: 'Withdraw pending bid refunds for the signer address.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  options: writeOptions,
  env: writeEnv,
  output: z.object({
    address: z.string(),
    refundAmount: z.string(),
    refundAmountWei: z.string(),
    tx: txResultOutput.optional(),
  }),
  examples: [{ description: 'Withdraw all pending bid refunds' }],
  async run(c) {
    const account = resolveAccount(c.env);
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);

    // --- Pre-flight: check pending refund ---
    const pendingAmount = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'pendingReturns',
      args: [account.address],
    })) as bigint;

    if (pendingAmount === 0n) {
      return c.ok({
        address: toChecksum(account.address),
        refundAmount: '0 ETH',
        refundAmountWei: '0',
      });
    }

    // --- Execute withdraw ---
    const txResult = await assemblyWriteTx({
      env: c.env,
      options: c.options,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      abi: councilSeatsAbi,
      functionName: 'withdrawRefund',
    });

    return c.ok({
      address: toChecksum(account.address),
      refundAmount: eth(pendingAmount),
      refundAmountWei: pendingAmount.toString(),
      tx: txResult as FormattedTxResult | FormattedDryRunResult,
    });
  },
});
