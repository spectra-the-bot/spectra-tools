import { z } from 'incur';

/**
 * Output schemas for DeBank responses.
 *
 * These are used by incur for `--schema` output and `skills add` documentation
 * generation (they are NOT runtime-validated against responses, so `.passthrough()`
 * keeps them honest: DeBank may add fields, and these document the load-bearing
 * ones an agent will actually use). Field descriptions are sourced from the
 * official DeBank Pro API reference (https://docs.cloud.debank.com).
 */

/** A blockchain network as returned by /v1/chain and /v1/chain/list. */
export const chainSchema = z
  .object({
    id: z.string().describe("Chain id (e.g. 'eth', 'bsc', 'xdai')"),
    community_id: z.number().describe('Community-identified numeric id (e.g. 1 for Ethereum)'),
    name: z.string().describe("Chain display name (e.g. 'Ethereum')"),
    logo_url: z.string().describe('URL of the chain logo (may be null if unavailable)'),
    native_token_id: z.string().describe("Native token id (e.g. 'eth')"),
    wrapped_token_id: z.string().describe('Wrapped ERC-20 contract address of the native token'),
    is_support_pre_exec: z
      .boolean()
      .describe('Whether the chain supports the pre-execution (simulate) tx API'),
  })
  .passthrough()
  .describe('Blockchain network metadata');

/** A DeFi protocol as returned by /v1/protocol and /v1/protocol/list. */
export const protocolSchema = z
  .object({
    id: z.string().describe("Protocol id (e.g. 'compound', 'uniswap')"),
    chain: z.string().describe('Chain id the protocol is on'),
    name: z.string().describe('Protocol name (may be null if unavailable)'),
    logo_url: z.string().describe('URL of the protocol logo (may be null if unavailable)'),
    site_url: z.string().describe('Protocol site URL (prioritizes the interactive app)'),
    has_supported_portfolio: z
      .boolean()
      .describe('Whether DeBank supports portfolio tracking for this protocol'),
    tvl: z.number().describe('Total user deposit value (USD) in this protocol'),
  })
  .passthrough()
  .describe('DeFi protocol metadata');

/** A token as returned by /v1/token. */
export const tokenSchema = z
  .object({
    id: z.string().describe('Token contract address (or native token id)'),
    chain: z.string().describe('Chain id the token is on'),
    name: z.string().describe('Token name (may be null if undefined)'),
    symbol: z.string().describe('Token symbol (may be null if undefined)'),
    display_symbol: z
      .string()
      .describe('Symbol disambiguated across same-symbol tokens (may be null)'),
    optimized_symbol: z.string().describe('Front-end-friendly symbol (may be null)'),
    decimals: z.number().describe('Token decimals (may be null if undefined)'),
    protocol_id: z.string().describe('Associated protocol id (empty string if none)'),
    logo_url: z.string().describe('URL of the token logo (may be null if none)'),
    is_core: z.boolean().describe('Whether DeBank shows this as a common wallet token'),
    price: z.number().describe('USD price (0 means no price data)'),
    time_at: z.number().describe('On-chain deployment timestamp (Unix seconds)'),
  })
  .passthrough()
  .describe('Token metadata');

/** Pagination metadata attached to every list response by this CLI. */
export const paginationSchema = z
  .object({
    page: z.number().describe('Current page number (1-based)'),
    pageSize: z.number().describe('Records per page'),
    totalItems: z.number().describe('Total number of items across all pages'),
    totalPages: z.number().describe('Total number of pages'),
  })
  .describe('Client-side pagination metadata');

/**
 * Wrap an item schema in this CLI's `{ data, pagination }` list envelope.
 * The envelope itself is guaranteed by the CLI (see paginate()); only the item
 * fields come from DeBank.
 */
export function paginatedOutput<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      data: z.array(item).describe('Page of results'),
      pagination: paginationSchema,
    })
    .describe('Paginated list of results');
}

/** USD balance scoped to a single chain (/v1/user/chain_balance). */
export const chainBalanceSchema = z
  .object({
    usd_value: z.number().describe('Total USD value held on the chain'),
  })
  .passthrough()
  .describe('Single-chain USD balance');

/** Historical token price (/v1/token/history_price). */
export const tokenHistoryPriceSchema = z
  .object({
    price: z.number().describe('Historical USD price at the requested date'),
  })
  .passthrough()
  .describe('Historical token price');
