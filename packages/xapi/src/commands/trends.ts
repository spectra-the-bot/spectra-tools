import { Cli, z } from 'incur';
import { createXApiClient } from '../api.js';
import { readAuthToken, xApiEnv } from '../auth.js';

const trends = Cli.create('trends', {
  description: 'Explore trending topics on X.',
});

trends.command('places', {
  description: 'List places where trending topics are available.',
  env: xApiEnv,
  output: z.object({
    places: z.array(
      z.object({
        woeid: z.number(),
        name: z.string(),
        country: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ description: 'List all trending places' }],
  async run(c) {
    const client = createXApiClient(readAuthToken());
    const res = await client.getTrendingPlaces();
    const places = res.data ?? [];
    const first = places[0];
    return c.ok(
      { places, count: places.length },
      {
        cta: first
          ? {
              description: 'Next steps:',
              commands: [
                {
                  command: 'trends location',
                  args: { woeid: first.woeid },
                  description: `View trends for ${first.name}`,
                },
              ],
            }
          : undefined,
      },
    );
  },
});

trends.command('location', {
  description: 'Get trending topics for a specific location (WOEID).',
  args: z.object({
    woeid: z.string().describe('Where On Earth ID (from trends places)'),
  }),
  env: xApiEnv,
  output: z.object({
    trends: z.array(
      z.object({
        name: z.string(),
        query: z.string(),
        tweet_volume: z.number().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    { args: { woeid: '1' }, description: 'Get worldwide trends' },
    { args: { woeid: '2459115' }, description: 'Get trends for New York' },
  ],
  async run(c) {
    const client = createXApiClient(readAuthToken());
    const res = await client.getTrendsByLocation(Number(c.args.woeid));
    const trendItems = res.data ?? [];
    const firstTrend = trendItems[0];
    return c.ok(
      { trends: trendItems, count: trendItems.length },
      {
        cta: firstTrend
          ? {
              description: 'Next steps:',
              commands: [
                {
                  command: 'posts search',
                  args: { query: firstTrend.query },
                  description: `Search posts about "${firstTrend.name}"`,
                },
              ],
            }
          : undefined,
      },
    );
  },
});

export { trends };
