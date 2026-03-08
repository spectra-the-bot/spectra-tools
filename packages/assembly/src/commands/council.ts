import { Cli, z } from 'incur';
import { councilSeatsAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

const env = z.object({ ABSTRACT_RPC_URL: z.string().optional() });

export const council = Cli.create('council', {
  description: 'Read council seat and auction state.',
});

council.command('seats', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seatCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
    const seats = ids.length
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
    return c.ok(
      seats.map((seat: Record<string, unknown>, idx: number) => ({
        id: idx,
        owner: toChecksum(seat.owner),
        startAt: Number(seat.startAt),
        startAtRelative: relTime(seat.startAt),
        endAt: Number(seat.endAt),
        endAtRelative: relTime(seat.endAt),
        forfeited: seat.forfeited,
      })),
    );
  },
});

council.command('seat', {
  args: z.object({ id: z.coerce.number().int().nonnegative() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const seat = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seats',
      args: [BigInt(c.args.id)],
    });
    return c.ok({
      id: c.args.id,
      ...seat,
      owner: toChecksum(seat.owner),
      endAtRelative: relTime(seat.endAt),
    });
  },
});

council.command('members', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'seatCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
    const seats = ids.length
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
    const activeOwners = [
      ...new Set(
        seats
          .filter(
            (x: Record<string, unknown>) =>
              !x.forfeited && Number(x.endAt) > Math.floor(Date.now() / 1000),
          )
          .map((x: Record<string, unknown>) => x.owner as string),
      ),
    ] as string[];
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
  args: z.object({ address: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const isMember = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'isCouncilMember',
      args: [c.args.address],
    });
    return c.ok({ address: toChecksum(c.args.address), isMember });
  },
});

council.command('voting-power', {
  args: z.object({ address: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const votingPower = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'getVotingPower',
      args: [c.args.address],
    });
    return c.ok({ address: toChecksum(c.args.address), votingPower: asNum(votingPower) });
  },
});

council.command('auctions', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [day, slot, slotsPerDay] = await Promise.all([
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
    ]);
    const recent: Array<{ day: bigint; slot: number }> = [];
    for (let d = Number(day) - 1; d <= Number(day); d++) {
      if (d < 0) continue;
      for (let s = 0; s < Number(slotsPerDay); s++) recent.push({ day: BigInt(d), slot: s });
    }
    const auctions = recent.length
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
    return c.ok(
      {
        currentDay: asNum(day),
        currentSlot: asNum(slot),
        auctions: recent.map((x, i) => ({
          ...x,
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
  args: z.object({
    day: z.coerce.number().int().nonnegative(),
    slot: z.coerce.number().int().nonnegative(),
  }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const auction = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'auctions',
      args: [BigInt(c.args.day), c.args.slot],
    });
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
  args: z.object({ address: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const amount = await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'pendingReturns',
      args: [c.args.address],
    });
    return c.ok({
      address: toChecksum(c.args.address),
      pendingRefund: eth(amount),
      pendingRefundWei: amount.toString(),
    });
  },
});

council.command('params', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [SEAT_TERM, AUCTION_SLOT_DURATION, AUCTION_SLOTS_PER_DAY, auctionEpochStart] =
      await Promise.all([
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
      ]);
    const [auctionWindowStart, auctionWindowEnd] = await Promise.all([
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
    ]);
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
