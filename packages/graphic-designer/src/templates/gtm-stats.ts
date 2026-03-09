import { z } from 'incur';
import type { DesignSpec } from '../spec.schema.js';
import { buildBaseSpec, templateBaseSchema } from './_base.js';

const statSchema = z
  .object({
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(32),
    insight: z.string().min(1).max(180),
    delta: z.string().min(1).max(24).optional(),
  })
  .strict();

export const gtmStatsDataSchema = templateBaseSchema
  .extend({
    stats: z.array(statSchema).min(3).max(9),
  })
  .strict();

export type GtmStatsData = z.infer<typeof gtmStatsDataSchema>;

export function buildGtmStatsSpec(input: unknown): DesignSpec {
  const data = gtmStatsDataSchema.parse(input);
  const cards = data.stats.map((stat, index) => ({
    id: `stat-${index + 1}`,
    title: stat.label,
    body: stat.delta ? `${stat.insight} • Δ ${stat.delta}` : stat.insight,
    badge: 'metric',
    metric: stat.value,
    tone: stat.delta?.startsWith('-') ? 'warning' : 'accent',
  })) satisfies DesignSpec['cards'];

  return buildBaseSpec({
    template: 'gtm-stats',
    title: data.title,
    eyebrow: data.eyebrow ?? 'GTM PERFORMANCE SNAPSHOT',
    tagline: data.tagline ?? 'QA-gated visual stats card set',
    cards,
    columns: Math.min(3, cards.length),
    templateVersion: '1.0.0',
    ...(data.subtitle ? { subtitle: data.subtitle } : {}),
    ...(data.footer ? { footer: data.footer } : {}),
  });
}
