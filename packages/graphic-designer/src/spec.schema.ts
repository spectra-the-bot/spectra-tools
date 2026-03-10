import { z } from 'zod';
import {
  builtInThemeBackgrounds,
  builtInThemeSchema,
  builtInThemes,
  defaultTheme,
  resolveTheme,
  themeSchema,
} from './themes/index.js';
import { normalizeColor } from './utils/color.js';

const colorHexSchema = z
  .string()
  .refine(
    (v) => {
      try {
        normalizeColor(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Expected #RRGGBB, #RRGGBBAA, rgb(), or rgba() color' },
  )
  .transform((v) => normalizeColor(v));

const gradientStopSchema = z
  .object({
    offset: z.number().min(0).max(1),
    color: colorHexSchema,
  })
  .strict();

const linearGradientSchema = z
  .object({
    type: z.literal('linear'),
    angle: z.number().default(180),
    stops: z.array(gradientStopSchema).min(2),
  })
  .strict();

const radialGradientSchema = z
  .object({
    type: z.literal('radial'),
    stops: z.array(gradientStopSchema).min(2),
  })
  .strict();

const gradientSchema = z.discriminatedUnion('type', [linearGradientSchema, radialGradientSchema]);

const drawFontFamilySchema = z.enum(['heading', 'body', 'mono']);

const drawRectSchema = z
  .object({
    type: z.literal('rect'),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    fill: colorHexSchema.optional(),
    stroke: colorHexSchema.optional(),
    strokeWidth: z.number().min(0).max(32).default(0),
    radius: z.number().min(0).max(256).default(0),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawCircleSchema = z
  .object({
    type: z.literal('circle'),
    cx: z.number(),
    cy: z.number(),
    radius: z.number().positive(),
    fill: colorHexSchema.optional(),
    stroke: colorHexSchema.optional(),
    strokeWidth: z.number().min(0).max(32).default(0),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawTextSchema = z
  .object({
    type: z.literal('text'),
    x: z.number(),
    y: z.number(),
    text: z.string().min(1).max(500),
    fontSize: z.number().min(6).max(200).default(16),
    fontWeight: z.number().int().min(100).max(900).default(400),
    fontFamily: drawFontFamilySchema.default('body'),
    color: colorHexSchema.default('#FFFFFF'),
    align: z.enum(['left', 'center', 'right']).default('left'),
    baseline: z.enum(['top', 'middle', 'alphabetic', 'bottom']).default('alphabetic'),
    letterSpacing: z.number().min(-10).max(50).default(0),
    maxWidth: z.number().positive().optional(),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawLineSchema = z
  .object({
    type: z.literal('line'),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    color: colorHexSchema.default('#FFFFFF'),
    width: z.number().min(0.5).max(32).default(2),
    dash: z.array(z.number()).max(6).optional(),
    arrow: z.enum(['none', 'end', 'start', 'both']).default('none'),
    arrowSize: z.number().min(4).max(32).default(10),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawPointSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

const drawBezierSchema = z
  .object({
    type: z.literal('bezier'),
    points: z.array(drawPointSchema).min(2).max(20),
    color: colorHexSchema.default('#FFFFFF'),
    width: z.number().min(0.5).max(32).default(2),
    dash: z.array(z.number()).max(6).optional(),
    arrow: z.enum(['none', 'end', 'start', 'both']).default('none'),
    arrowSize: z.number().min(4).max(32).default(10),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawPathSchema = z
  .object({
    type: z.literal('path'),
    d: z.string().min(1).max(4000),
    fill: colorHexSchema.optional(),
    stroke: colorHexSchema.optional(),
    strokeWidth: z.number().min(0).max(32).default(0),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawBadgeSchema = z
  .object({
    type: z.literal('badge'),
    x: z.number(),
    y: z.number(),
    text: z.string().min(1).max(64),
    fontSize: z.number().min(6).max(48).default(12),
    fontFamily: drawFontFamilySchema.default('mono'),
    color: colorHexSchema.default('#FFFFFF'),
    background: colorHexSchema.default('#334B83'),
    paddingX: z.number().min(0).max(64).default(10),
    paddingY: z.number().min(0).max(32).default(4),
    borderRadius: z.number().min(0).max(64).default(12),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawGradientRectSchema = z
  .object({
    type: z.literal('gradient-rect'),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    gradient: gradientSchema,
    radius: z.number().min(0).max(256).default(0),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

const drawGridSchema = z
  .object({
    type: z.literal('grid'),
    spacing: z.number().min(5).max(200).default(40),
    color: colorHexSchema.default('#1E2D4A'),
    width: z.number().min(0.1).max(4).default(0.5),
    opacity: z.number().min(0).max(1).default(0.2),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
  })
  .strict();

const drawCommandSchema = z.discriminatedUnion('type', [
  drawRectSchema,
  drawCircleSchema,
  drawTextSchema,
  drawLineSchema,
  drawBezierSchema,
  drawPathSchema,
  drawBadgeSchema,
  drawGradientRectSchema,
  drawGridSchema,
]);

/** Default canvas dimensions and padding (1200 × 675 px, 48 px padding). */
export const defaultCanvas = {
  width: 1200,
  height: 675,
  padding: 48,
} as const;

/** Default QA constraint thresholds applied when no explicit constraints are given. */
export const defaultConstraints = {
  minContrastRatio: 4.5,
  minFooterSpacing: 16,
  checkOverlaps: true,
  maxTextTruncation: 0.1,
} as const;

/** Default auto-layout config used for flowcharts (ELK layered, top-to-bottom). */
export const defaultAutoLayout = {
  mode: 'auto',
  algorithm: 'layered',
  direction: 'TB',
  nodeSpacing: 80,
  rankSpacing: 120,
  edgeRouting: 'polyline',
} as const;

/** Default grid layout config (3 columns, 24 px gap, variable height). */
export const defaultGridLayout = {
  mode: 'grid',
  columns: 3,
  gap: 24,
  equalHeight: false,
} as const;

/** Default stack layout config (vertical direction, 24 px gap, stretch alignment). */
export const defaultStackLayout = {
  mode: 'stack',
  direction: 'vertical',
  gap: 24,
  alignment: 'stretch',
} as const;

/** Default layout configuration — alias for {@link defaultGridLayout}. */
export const defaultLayout = defaultGridLayout;

/**
 * Infer the most appropriate layout mode from the element types present in a
 * design spec.
 *
 * When an explicit layout is provided it is returned as-is. Otherwise the
 * heuristic inspects the element list:
 *
 * - Flow-nodes **and** connections → {@link defaultAutoLayout} (ELK graph).
 * - All cards → {@link defaultGridLayout}.
 * - Contains code-block or terminal → {@link defaultStackLayout}.
 * - Fallback → {@link defaultGridLayout}.
 *
 * @param elements - The array of spec elements to inspect.
 * @param explicitLayout - An optional explicit layout config that short-circuits
 *   inference when provided.
 * @returns The resolved {@link LayoutConfig}.
 */
export function inferLayout(elements: Element[], explicitLayout?: LayoutConfig): LayoutConfig {
  if (explicitLayout) {
    return explicitLayout;
  }

  const hasFlowNodes = elements.some((element) => element.type === 'flow-node');
  const hasConnections = elements.some((element) => element.type === 'connection');
  const hasOnlyCards = elements.every((element) => element.type === 'card');
  const hasCodeOrTerminal = elements.some(
    (element) => element.type === 'code-block' || element.type === 'terminal',
  );

  if (hasFlowNodes && hasConnections) {
    return defaultAutoLayout;
  }

  if (hasOnlyCards) {
    return defaultGridLayout;
  }

  if (hasCodeOrTerminal) {
    return defaultStackLayout;
  }

  return defaultGridLayout;
}

const cardElementSchema = z
  .object({
    type: z.literal('card'),
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
    badge: z.string().min(1).max(64).optional(),
    metric: z.string().min(1).max(80).optional(),
    tone: z.enum(['neutral', 'accent', 'success', 'warning', 'error']).default('neutral'),
    icon: z.string().min(1).max(64).optional(),
  })
  .strict();

const flowNodeShadowSchema = z
  .object({
    color: colorHexSchema.optional(),
    blur: z.number().min(0).max(64).default(8),
    offsetX: z.number().min(-32).max(32).default(0),
    offsetY: z.number().min(-32).max(32).default(0),
    opacity: z.number().min(0).max(1).default(0.3),
  })
  .strict();

export const flowNodeElementSchema = z
  .object({
    type: z.literal('flow-node'),
    id: z.string().min(1).max(120),
    shape: z
      .enum([
        'box',
        'rounded-box',
        'diamond',
        'circle',
        'pill',
        'cylinder',
        'parallelogram',
        'hexagon',
      ])
      .default('rounded-box'),
    label: z.string().min(1).max(200),
    sublabel: z.string().min(1).max(300).optional(),
    sublabelColor: colorHexSchema.optional(),
    sublabel2: z.string().min(1).max(300).optional(),
    sublabel2Color: colorHexSchema.optional(),
    sublabel2FontSize: z.number().min(8).max(32).optional(),
    labelColor: colorHexSchema.optional(),
    labelFontSize: z.number().min(10).max(48).optional(),
    color: colorHexSchema.optional(),
    borderColor: colorHexSchema.optional(),
    borderWidth: z.number().min(0.5).max(8).optional(),
    cornerRadius: z.number().min(0).max(64).optional(),
    width: z.number().int().min(40).max(800).optional(),
    height: z.number().int().min(30).max(600).optional(),
    fillOpacity: z.number().min(0).max(1).default(1),
    opacity: z.number().min(0).max(1).default(1),
    badgeText: z.string().min(1).max(32).optional(),
    badgeColor: colorHexSchema.optional(),
    badgeBackground: colorHexSchema.optional(),
    badgePosition: z.enum(['top', 'inside-top']).default('inside-top'),
    shadow: flowNodeShadowSchema.optional(),
  })
  .strict();

export const connectionElementSchema = z
  .object({
    type: z.literal('connection'),
    from: z.string().min(1).max(120),
    to: z.string().min(1).max(120),
    style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    strokeStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    arrow: z.enum(['end', 'start', 'both', 'none']).default('end'),
    label: z.string().min(1).max(200).optional(),
    labelPosition: z.enum(['start', 'middle', 'end']).default('middle'),
    color: colorHexSchema.optional(),
    width: z.number().min(0.5).max(10).optional(),
    strokeWidth: z.number().min(0.5).max(10).default(2),
    arrowSize: z.number().min(4).max(32).optional(),
    opacity: z.number().min(0).max(1).default(1),
    routing: z.enum(['auto', 'orthogonal', 'curve', 'arc']).default('auto'),
    tension: z.number().min(0.1).max(0.8).default(0.35),
  })
  .strict();

const codeBlockStyleSchema = z
  .object({
    paddingVertical: z.number().min(0).max(128).default(56),
    paddingHorizontal: z.number().min(0).max(128).default(56),
    windowControls: z.enum(['macos', 'bw', 'none']).default('macos'),
    dropShadow: z.boolean().default(true),
    dropShadowOffsetY: z.number().min(0).max(100).default(20),
    dropShadowBlurRadius: z.number().min(0).max(200).default(68),
    surroundColor: z.string().optional(),
    fontSize: z.number().min(8).max(32).default(14),
    lineHeightPercent: z.number().min(100).max(200).default(143),
    scale: z.number().int().min(1).max(4).default(2),
  })
  .partial();

const codeBlockElementSchema = z
  .object({
    type: z.literal('code-block'),
    id: z.string().min(1).max(120),
    code: z.string().min(1),
    language: z.string().min(1).max(40),
    theme: z.string().min(1).max(80).optional(),
    showLineNumbers: z.boolean().default(false),
    highlightLines: z.array(z.number().int().positive()).max(500).optional(),
    startLine: z.number().int().positive().default(1),
    title: z.string().min(1).max(200).optional(),
    style: codeBlockStyleSchema.optional(),
  })
  .strict();

const terminalElementSchema = z
  .object({
    type: z.literal('terminal'),
    id: z.string().min(1).max(120),
    content: z.string().min(1),
    prompt: z.string().min(1).max(24).optional(),
    title: z.string().min(1).max(200).optional(),
    showPrompt: z.boolean().default(true),
    style: codeBlockStyleSchema.optional(),
  })
  .strict();

const textElementSchema = z
  .object({
    type: z.literal('text'),
    id: z.string().min(1).max(120),
    content: z.string().min(1).max(4000),
    style: z.enum(['heading', 'subheading', 'body', 'caption', 'code']),
    align: z.enum(['left', 'center', 'right']).default('left'),
    color: colorHexSchema.optional(),
  })
  .strict();

const shapeElementSchema = z
  .object({
    type: z.literal('shape'),
    id: z.string().min(1).max(120),
    shape: z.enum(['rectangle', 'rounded-rectangle', 'circle', 'ellipse', 'line', 'arrow']),
    fill: colorHexSchema.optional(),
    stroke: colorHexSchema.optional(),
    strokeWidth: z.number().min(0).max(64).default(1),
  })
  .strict();

const imageElementSchema = z
  .object({
    type: z.literal('image'),
    id: z.string().min(1).max(120),
    src: z.string().min(1),
    alt: z.string().max(240).optional(),
    fit: z.enum(['contain', 'cover', 'fill', 'none']).default('contain'),
    borderRadius: z.number().min(0).default(0),
  })
  .strict();

const elementSchema = z.discriminatedUnion('type', [
  cardElementSchema,
  flowNodeElementSchema,
  connectionElementSchema,
  codeBlockElementSchema,
  terminalElementSchema,
  textElementSchema,
  shapeElementSchema,
  imageElementSchema,
]);

const diagramCenterSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

const autoLayoutConfigSchema = z
  .object({
    mode: z.literal('auto'),
    algorithm: z.enum(['layered', 'stress', 'force', 'radial', 'box']).default('layered'),
    direction: z.enum(['TB', 'BT', 'LR', 'RL']).default('TB'),
    nodeSpacing: z.number().int().min(0).max(512).default(80),
    rankSpacing: z.number().int().min(0).max(512).default(120),
    edgeRouting: z.enum(['orthogonal', 'polyline', 'spline']).default('polyline'),
    aspectRatio: z.number().min(0.5).max(3).optional(),
    /** ID of the root node for radial layout. Only relevant when algorithm is 'radial'. */
    radialRoot: z.string().min(1).max(120).optional(),
    /** Fixed radius in pixels for radial layout. Only relevant when algorithm is 'radial'. */
    radialRadius: z.number().positive().optional(),
    /** Compaction strategy for radial layout. Only relevant when algorithm is 'radial'. */
    radialCompaction: z.enum(['none', 'radial', 'wedge']).optional(),
    /** Sort strategy for radial layout node ordering. Only relevant when algorithm is 'radial'. */
    radialSortBy: z.enum(['id', 'connections']).optional(),
    /** Explicit center used by curve/arc connection routing. */
    diagramCenter: diagramCenterSchema.optional(),
  })
  .strict();

const gridLayoutConfigSchema = z
  .object({
    mode: z.literal('grid'),
    columns: z.number().int().min(1).max(12).default(3),
    gap: z.number().int().min(0).max(256).default(24),
    cardMinHeight: z.number().int().min(32).max(4096).optional(),
    cardMaxHeight: z.number().int().min(32).max(4096).optional(),
    equalHeight: z.boolean().default(false),
    /** Explicit center used by curve/arc connection routing. */
    diagramCenter: diagramCenterSchema.optional(),
  })
  .strict();

const stackLayoutConfigSchema = z
  .object({
    mode: z.literal('stack'),
    direction: z.enum(['vertical', 'horizontal']).default('vertical'),
    gap: z.number().int().min(0).max(256).default(24),
    alignment: z.enum(['start', 'center', 'end', 'stretch']).default('stretch'),
    /** Explicit center used by curve/arc connection routing. */
    diagramCenter: diagramCenterSchema.optional(),
  })
  .strict();

const manualPositionSchema = z
  .object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

const manualLayoutConfigSchema = z
  .object({
    mode: z.literal('manual'),
    positions: z.record(z.string().min(1), manualPositionSchema).default({}),
    /** Explicit center used by curve/arc connection routing. */
    diagramCenter: diagramCenterSchema.optional(),
  })
  .strict();

const layoutConfigSchema = z.discriminatedUnion('mode', [
  autoLayoutConfigSchema,
  gridLayoutConfigSchema,
  stackLayoutConfigSchema,
  manualLayoutConfigSchema,
]);

const constraintsSchema = z
  .object({
    minContrastRatio: z.number().min(3).max(21).default(4.5),
    minFooterSpacing: z.number().int().min(0).max(256).default(16),
    checkOverlaps: z.boolean().default(true),
    maxTextTruncation: z.number().min(0).max(1).default(0.1),
  })
  .strict();

const headerSchema = z
  .object({
    eyebrow: z.string().min(1).max(120).optional(),
    title: z.string().min(1).max(300),
    subtitle: z.string().min(1).max(400).optional(),
    align: z.enum(['left', 'center', 'right']).default('center'),
    titleLetterSpacing: z.number().min(-2).max(20).default(0),
    titleFontSize: z.number().min(16).max(96).optional(),
  })
  .strict();

const footerSchema = z
  .object({
    text: z.string().min(1).max(300),
    tagline: z.string().min(1).max(200).optional(),
  })
  .strict();

const decoratorSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('rainbow-rule'),
      y: z.enum(['after-header', 'before-footer', 'custom']).default('after-header'),
      customY: z.number().optional(),
      thickness: z.number().positive().max(64).default(2),
      colors: z.array(colorHexSchema).min(2).optional(),
      margin: z.number().min(0).max(512).default(16),
    })
    .strict(),
  z
    .object({
      type: z.literal('vignette'),
      intensity: z.number().min(0).max(1).default(0.3),
      color: colorHexSchema.default('#000000'),
    })
    .strict(),
  z
    .object({
      type: z.literal('gradient-overlay'),
      gradient: gradientSchema,
      opacity: z.number().min(0).max(1).default(0.5),
    })
    .strict(),
]);

const canvasSchema = z
  .object({
    width: z.number().int().min(320).max(4096).default(defaultCanvas.width),
    height: z.number().int().min(180).max(4096).default(defaultCanvas.height),
    padding: z.number().int().min(0).max(256).default(defaultCanvas.padding),
  })
  .strict();

const themeInputSchema = z.union([builtInThemeSchema, themeSchema]);

const diagramPositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();

export const diagramElementSchema = z.discriminatedUnion('type', [
  flowNodeElementSchema,
  connectionElementSchema,
]);

export const diagramLayoutSchema = z
  .object({
    mode: z.enum(['manual', 'auto']).default('manual'),
    positions: z.record(z.string(), diagramPositionSchema).optional(),
    diagramCenter: diagramCenterSchema.optional(),
  })
  .strict();

export const diagramSpecSchema = z
  .object({
    version: z.literal(1),
    canvas: z
      .object({
        width: z.number().int().min(320).max(4096).default(1200),
        height: z.number().int().min(180).max(4096).default(675),
      })
      .default({ width: 1200, height: 675 }),
    theme: themeSchema.optional(),
    elements: z.array(diagramElementSchema).min(1),
    layout: diagramLayoutSchema.default({ mode: 'manual' }),
  })
  .strict();

/** Zod schema that validates and transforms raw input into a fully resolved {@link DesignSpec}. This is the source of truth for spec validation. */
export const designSpecSchema = z
  .object({
    version: z.literal(2).default(2),
    canvas: canvasSchema.default(defaultCanvas),
    theme: themeInputSchema.default('dark'),
    background: z.union([colorHexSchema, gradientSchema]).optional(),
    header: headerSchema.optional(),
    elements: z.array(elementSchema).default([]),
    footer: footerSchema.optional(),
    decorators: z.array(decoratorSchema).default([]),
    draw: z.array(drawCommandSchema).max(200).default([]),
    layout: layoutConfigSchema.optional(),
    constraints: constraintsSchema.default(defaultConstraints),
  })
  .strict()
  .transform((spec) => ({
    ...spec,
    layout: inferLayout(spec.elements, spec.layout),
  }));

export type DesignSpec = z.infer<typeof designSpecSchema>;
export type Element = z.infer<typeof elementSchema>;
export type CardElement = z.infer<typeof cardElementSchema>;
export type FlowNodeElement = z.infer<typeof flowNodeElementSchema>;
export type FlowNodeShadow = z.infer<typeof flowNodeShadowSchema>;
export type ConnectionElement = z.infer<typeof connectionElementSchema>;
export type DiagramElement = z.infer<typeof diagramElementSchema>;
export type DiagramLayout = z.infer<typeof diagramLayoutSchema>;
export type DiagramSpec = z.infer<typeof diagramSpecSchema>;
export type CodeBlockStyle = z.infer<typeof codeBlockStyleSchema>;
export type CodeBlockElement = z.infer<typeof codeBlockElementSchema>;
export type TerminalElement = z.infer<typeof terminalElementSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type DrawFontFamily = z.infer<typeof drawFontFamilySchema>;
export type DrawPoint = z.infer<typeof drawPointSchema>;
export type DrawRect = z.infer<typeof drawRectSchema>;
export type DrawCircle = z.infer<typeof drawCircleSchema>;
export type DrawText = z.infer<typeof drawTextSchema>;
export type DrawLine = z.infer<typeof drawLineSchema>;
export type DrawBezier = z.infer<typeof drawBezierSchema>;
export type DrawPath = z.infer<typeof drawPathSchema>;
export type DrawBadge = z.infer<typeof drawBadgeSchema>;
export type DrawGradientRect = z.infer<typeof drawGradientRectSchema>;
export type DrawGrid = z.infer<typeof drawGridSchema>;
export type DrawCommand = z.infer<typeof drawCommandSchema>;
export type LayoutConfig = z.infer<typeof layoutConfigSchema>;
export type AutoLayoutConfig = z.infer<typeof autoLayoutConfigSchema>;
export type GridLayoutConfig = z.infer<typeof gridLayoutConfigSchema>;
export type StackLayoutConfig = z.infer<typeof stackLayoutConfigSchema>;
export type ManualLayoutConfig = z.infer<typeof manualLayoutConfigSchema>;
export type ConstraintSpec = z.infer<typeof constraintsSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type DesignTheme = Theme;
export type DesignCardSpec = CardElement;
export type BuiltInTheme = z.infer<typeof builtInThemeSchema>;
export type ThemeInput = z.infer<typeof themeInputSchema>;
export type GradientStop = z.infer<typeof gradientStopSchema>;
export type LinearGradient = z.infer<typeof linearGradientSchema>;
export type RadialGradient = z.infer<typeof radialGradientSchema>;
export type Gradient = z.infer<typeof gradientSchema>;
export type Decorator = z.infer<typeof decoratorSchema>;
export type RainbowRuleDecorator = Extract<Decorator, { type: 'rainbow-rule' }>;
export type VignetteDecorator = Extract<Decorator, { type: 'vignette' }>;
export type GradientOverlayDecorator = Extract<Decorator, { type: 'gradient-overlay' }>;

export type DesignSafeFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export { builtInThemeBackgrounds, builtInThemes, defaultTheme, resolveTheme };

/**
 * Compute the safe rendering area by insetting the canvas by its padding value.
 *
 * Elements positioned within the safe frame are guaranteed not to be clipped by
 * the canvas edges.
 *
 * @param spec - A parsed {@link DesignSpec} with resolved canvas dimensions and
 *   padding.
 * @returns A {@link DesignSafeFrame} rectangle describing the usable area.
 */
export function deriveSafeFrame(spec: DesignSpec): DesignSafeFrame {
  return {
    x: spec.canvas.padding,
    y: spec.canvas.padding,
    width: spec.canvas.width - spec.canvas.padding * 2,
    height: spec.canvas.height - spec.canvas.padding * 2,
  };
}

/**
 * Validate and parse raw input into a fully resolved {@link DesignSpec}.
 *
 * Uses {@link designSpecSchema} under the hood. Throws a `ZodError` if the
 * input does not conform to the schema.
 *
 * @param input - Raw (unvalidated) input object to parse.
 * @returns A validated and transformed {@link DesignSpec}.
 * @throws {import('zod').ZodError} When the input fails schema validation.
 */
export function parseDiagramSpec(input: unknown): DiagramSpec {
  return diagramSpecSchema.parse(input);
}

export function parseDesignSpec(input: unknown): DesignSpec {
  return designSpecSchema.parse(input);
}
