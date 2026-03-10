import { z } from 'incur';

/** Protocol summary from /protocols */
export const protocolSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  symbol: z.string().optional(),
  category: z.string().optional(),
  chains: z.array(z.string()).optional(),
  tvl: z.number().nullable().optional(),
  change_1h: z.number().nullable().optional(),
  change_1d: z.number().nullable().optional(),
  change_7d: z.number().nullable().optional(),
  mcap: z.number().nullable().optional(),
});

export type ProtocolSummary = z.infer<typeof protocolSummarySchema>;

/** Chain TVL entry from /v2/chains */
export const chainTvlSchema = z.object({
  gecko_id: z.string().nullable().optional(),
  tvl: z.number(),
  tokenSymbol: z.string().optional(),
  cmcId: z.string().nullable().optional(),
  name: z.string(),
  chainId: z.number().nullable().optional(),
});

export type ChainTvl = z.infer<typeof chainTvlSchema>;

/** TVL history point from /protocol/<slug> tvl array */
export const tvlHistoryPointSchema = z.object({
  date: z.number(),
  totalLiquidityUSD: z.number(),
});

export type TvlHistoryPoint = z.infer<typeof tvlHistoryPointSchema>;

/** Protocol detail from /protocol/<slug> */
export const protocolDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  description: z.string().optional(),
  symbol: z.string().optional(),
  category: z.string().nullable().optional(),
  chains: z.array(z.string()).optional(),
  tvl: z.array(tvlHistoryPointSchema).optional(),
  currentChainTvls: z.record(z.string(), z.number()).optional(),
  chainTvls: z
    .record(
      z.string(),
      z.object({
        tvl: z.array(tvlHistoryPointSchema).optional(),
      }),
    )
    .optional(),
  mcap: z.number().nullable().optional(),
});

export type ProtocolDetail = z.infer<typeof protocolDetailSchema>;

/** Volume entry from /overview/dexs */
export const volumeEntrySchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  total24h: z.number().nullable().optional(),
  total7d: z.number().nullable().optional(),
  total30d: z.number().nullable().optional(),
  change_1d: z.number().nullable().optional(),
  change_7d: z.number().nullable().optional(),
  change_1m: z.number().nullable().optional(),
});

export type VolumeEntry = z.infer<typeof volumeEntrySchema>;

/** Fee/revenue entry from /overview/fees */
export const feeEntrySchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  total24h: z.number().nullable().optional(),
  total7d: z.number().nullable().optional(),
  total30d: z.number().nullable().optional(),
  totalAllTime: z.number().nullable().optional(),
  change_1d: z.number().nullable().optional(),
});

export type FeeEntry = z.infer<typeof feeEntrySchema>;

/* ── Price schemas (coins.llama.fi) ─────────────────────────── */

/** Single coin price entry from /prices/current or /prices/historical */
export const coinPriceSchema = z.object({
  price: z.number(),
  decimals: z.number().optional(),
  symbol: z.string(),
  timestamp: z.number(),
  confidence: z.number().optional(),
});

export type CoinPrice = z.infer<typeof coinPriceSchema>;

/** Response from /prices/current/<coins> or /prices/historical/<timestamp>/<coins> */
export const pricesResponseSchema = z.object({
  coins: z.record(z.string(), coinPriceSchema),
});

export type PricesResponse = z.infer<typeof pricesResponseSchema>;

/** Single coin chart entry from /chart/<coins> */
export const coinChartSchema = z.object({
  decimals: z.number().optional(),
  symbol: z.string(),
  prices: z.array(z.object({ timestamp: z.number(), price: z.number() })),
  confidence: z.number().optional(),
});

export type CoinChart = z.infer<typeof coinChartSchema>;

/** Response from /chart/<coins> */
export const chartResponseSchema = z.object({
  coins: z.record(z.string(), coinChartSchema),
});

export type ChartResponse = z.infer<typeof chartResponseSchema>;
