import { Cli, z } from 'incur';
import { councilSeatsAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { relTime, timeValue, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

type SeatTuple = readonly [string, bigint, bigint, boolean];

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

/**
 * Top-level `seats` command group — compatibility alias for `council seats`.
 */
export const seats = Cli.create('seats', {
  description: 'Council seat aliases (compatibility shim for council seats).',
});

seats.command('list', {
  description: 'List all council seats and their occupancy windows (alias for council seats).',
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
    const seatList = (seatTuples as unknown[]).map(decodeSeat);

    return c.ok(
      seatList.map((seat, idx: number) => ({
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
