import { z } from 'incur';
import type { DesignSpec } from '../spec.schema.js';
import { buildBaseSpec, templateBaseSchema } from './_base.js';

const dispatchSchema = z
  .object({
    lane: z.string().min(1).max(80),
    status: z.enum(['queued', 'in-progress', 'complete', 'blocked']),
    nextAction: z.string().min(1).max(180),
    eta: z.string().min(1).max(32).optional(),
  })
  .strict();

export const scoutDispatchDataSchema = templateBaseSchema
  .extend({
    dispatches: z.array(dispatchSchema).min(3).max(8),
  })
  .strict();

export type ScoutDispatchData = z.infer<typeof scoutDispatchDataSchema>;

function statusToTone(
  status: ScoutDispatchData['dispatches'][number]['status'],
): DesignSpec['cards'][number]['tone'] {
  switch (status) {
    case 'complete':
      return 'success';
    case 'blocked':
      return 'warning';
    case 'in-progress':
      return 'accent';
    default:
      return 'neutral';
  }
}

export function buildScoutDispatchSpec(input: unknown): DesignSpec {
  const data = scoutDispatchDataSchema.parse(input);
  const cards = data.dispatches.map((item, index) => ({
    id: `dispatch-${index + 1}`,
    title: item.lane,
    body: item.nextAction,
    badge: item.status,
    metric: item.eta,
    tone: statusToTone(item.status),
  })) satisfies DesignSpec['cards'];

  return buildBaseSpec({
    template: 'scout-dispatch',
    title: data.title,
    eyebrow: data.eyebrow ?? 'SCOUT DISPATCH BOARD',
    tagline: data.tagline ?? 'Dispatch lanes with deterministic rendering',
    cards,
    columns: Math.min(3, cards.length),
    templateVersion: '1.0.0',
    ...(data.subtitle ? { subtitle: data.subtitle } : {}),
    ...(data.footer ? { footer: data.footer } : {}),
  });
}
