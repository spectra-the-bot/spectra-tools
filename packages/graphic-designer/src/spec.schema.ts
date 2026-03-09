import { z } from 'incur';

const colorHexSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Expected #RRGGBB or #RRGGBBAA color');

const safeFrameSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const themeSchema = z
  .object({
    background: colorHexSchema,
    surface: colorHexSchema,
    surfaceMuted: colorHexSchema,
    primary: colorHexSchema,
    accent: colorHexSchema,
    text: colorHexSchema,
    textMuted: colorHexSchema,
    footerText: colorHexSchema,
    fontFamily: z.string().min(1).max(120),
    monoFontFamily: z.string().min(1).max(120),
  })
  .strict();

const cardSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(360),
    badge: z.string().max(40).optional(),
    metric: z.string().max(40).optional(),
    tone: z.enum(['neutral', 'accent', 'success', 'warning']).default('neutral'),
  })
  .strict();

const headerSchema = z
  .object({
    eyebrow: z.string().min(1).max(64),
    title: z.string().min(1).max(120),
    subtitle: z.string().min(1).max(240).optional(),
  })
  .strict();

const footerSchema = z
  .object({
    text: z.string().min(1).max(200),
    tagline: z.string().min(1).max(140).optional(),
  })
  .strict();

const layoutSchema = z
  .object({
    columns: z.number().int().min(1).max(4).default(3),
    cardGap: z.number().int().min(4).max(64).default(18),
    sectionGap: z.number().int().min(8).max(96).default(24),
    cornerRadius: z.number().int().min(2).max(32).default(14),
  })
  .strict();

const constraintsSchema = z
  .object({
    minContrastRatio: z.number().min(3).max(21).default(4.5),
    minFooterSpacingPx: z.number().int().min(0).max(128).default(16),
    checkOverlaps: z.boolean().default(true),
    safeFrame: safeFrameSchema.optional(),
  })
  .strict();

const generationSchema = z
  .object({
    templateVersion: z.string().min(1).max(40),
  })
  .strict();

export const designSpecSchema = z
  .object({
    version: z.literal(1),
    template: z.enum(['gtm-pipeline', 'gtm-stats', 'scout-dispatch', 'custom']),
    canvas: z
      .object({
        width: z.number().int().min(320).max(4096).default(1200),
        height: z.number().int().min(180).max(4096).default(675),
        padding: z.number().int().min(0).max(256).default(72),
      })
      .strict(),
    theme: themeSchema,
    header: headerSchema,
    cards: z.array(cardSchema).min(1).max(12),
    footer: footerSchema,
    layout: layoutSchema,
    constraints: constraintsSchema,
    generation: generationSchema,
  })
  .strict();

export type DesignSpec = z.infer<typeof designSpecSchema>;
export type DesignCardSpec = z.infer<typeof cardSchema>;
export type DesignTheme = z.infer<typeof themeSchema>;
export type DesignSafeFrame = z.infer<typeof safeFrameSchema>;

export const defaultTheme: DesignTheme = {
  background: '#0B1020',
  surface: '#111936',
  surfaceMuted: '#1A2547',
  primary: '#7AA2FF',
  accent: '#65E4A3',
  text: '#E8EEFF',
  textMuted: '#AAB9E8',
  footerText: '#8B9CCB',
  fontFamily: 'Inter, system-ui, sans-serif',
  monoFontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
};

export const defaultCanvas = {
  width: 1200,
  height: 675,
  padding: 72,
} as const;

export const defaultLayout = {
  columns: 3,
  cardGap: 18,
  sectionGap: 24,
  cornerRadius: 14,
} as const;

export const defaultConstraints = {
  minContrastRatio: 4.5,
  minFooterSpacingPx: 16,
  checkOverlaps: true,
} as const;

export function deriveSafeFrame(spec: DesignSpec): DesignSafeFrame {
  const safeFrame = spec.constraints.safeFrame;
  if (safeFrame) {
    return safeFrame;
  }

  return {
    x: spec.canvas.padding,
    y: spec.canvas.padding,
    width: spec.canvas.width - spec.canvas.padding * 2,
    height: spec.canvas.height - spec.canvas.padding * 2,
  };
}

export function parseDesignSpec(input: unknown): DesignSpec {
  return designSpecSchema.parse(input);
}
