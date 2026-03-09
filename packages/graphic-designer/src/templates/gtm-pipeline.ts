import { z } from 'incur';
import type { DesignSpec } from '../spec.schema.js';
import { buildBaseSpec, templateBaseSchema } from './_base.js';

const stageSchema = z
  .object({
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(180),
    owner: z.string().min(1).max(60).optional(),
    metric: z.string().min(1).max(32).optional(),
  })
  .strict();

export const gtmPipelineDataSchema = templateBaseSchema
  .extend({
    stages: z.array(stageSchema).min(3).max(6),
  })
  .strict();

export type GtmPipelineData = z.infer<typeof gtmPipelineDataSchema>;

export function buildGtmPipelineSpec(input: unknown): DesignSpec {
  const data = gtmPipelineDataSchema.parse(input);
  const cards = data.stages.map((stage, index) => ({
    id: `stage-${index + 1}`,
    title: stage.name,
    body: stage.owner ? `${stage.description}\nOwner: ${stage.owner}` : stage.description,
    badge: `step ${index + 1}`,
    metric: stage.metric,
    tone: index === data.stages.length - 1 ? 'success' : 'accent',
  })) satisfies DesignSpec['cards'];

  return buildBaseSpec({
    template: 'gtm-pipeline',
    title: data.title,
    eyebrow: data.eyebrow ?? 'GO-TO-MARKET PIPELINE',
    tagline: data.tagline ?? 'Spec-driven render • deterministic output',
    cards,
    columns: Math.min(3, cards.length),
    templateVersion: '1.0.0',
    ...(data.subtitle ? { subtitle: data.subtitle } : {}),
    ...(data.footer ? { footer: data.footer } : {}),
  });
}
