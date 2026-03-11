/**
 * Token extraction from Figma API file responses.
 *
 * Parses paint styles → color tokens, text styles → typography tokens,
 * and effect styles → shadow/blur tokens into a normalized intermediate
 * representation that can be converted to various output formats.
 */

// ---------------------------------------------------------------------------
// Intermediate token types
// ---------------------------------------------------------------------------

export interface ColorToken {
  readonly name: string;
  readonly hex: string;
  readonly rgba: { r: number; g: number; b: number; a: number };
}

export interface TypographyToken {
  readonly name: string;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly lineHeight: number | null;
  readonly letterSpacing: number;
}

export interface ShadowToken {
  readonly name: string;
  readonly type: 'drop-shadow' | 'inner-shadow';
  readonly color: { r: number; g: number; b: number; a: number };
  readonly offsetX: number;
  readonly offsetY: number;
  readonly radius: number;
  readonly spread: number;
}

export interface BlurToken {
  readonly name: string;
  readonly type: 'layer-blur' | 'background-blur';
  readonly radius: number;
}

export type EffectToken = ShadowToken | BlurToken;

export interface ExtractedTokens {
  readonly colors: readonly ColorToken[];
  readonly typography: readonly TypographyToken[];
  readonly effects: readonly EffectToken[];
}

export type TokenFilter = 'colors' | 'typography' | 'effects';

// ---------------------------------------------------------------------------
// Figma API node shapes (minimal subset for extraction)
// ---------------------------------------------------------------------------

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaPaint {
  type: string;
  color?: FigmaColor;
  opacity?: number;
  visible?: boolean;
}

interface FigmaTypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}

interface FigmaEffect {
  type: string;
  visible?: boolean;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  style?: FigmaTypeStyle;
  children?: FigmaNode[];
}

interface FigmaStyleMeta {
  key: string;
  name: string;
  style_type: string;
  description?: string;
  node_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function toHex(r: number, g: number, b: number, a: number): string {
  const r8 = Math.round(clamp(r, 0, 1) * 255);
  const g8 = Math.round(clamp(g, 0, 1) * 255);
  const b8 = Math.round(clamp(b, 0, 1) * 255);
  const hex = `#${r8.toString(16).padStart(2, '0')}${g8.toString(16).padStart(2, '0')}${b8.toString(16).padStart(2, '0')}`;
  if (a < 1) {
    const a8 = Math.round(clamp(a, 0, 1) * 255);
    return `${hex}${a8.toString(16).padStart(2, '0')}`;
  }
  return hex;
}

function sanitizeName(name: string): string {
  return name.trim() || 'unnamed';
}

// ---------------------------------------------------------------------------
// Paint → Color extraction
// ---------------------------------------------------------------------------

function extractColorFromPaints(name: string, fills: FigmaPaint[]): ColorToken | null {
  // Find first visible SOLID fill
  const solid = fills.find((f) => f.type === 'SOLID' && f.visible !== false && f.color);
  if (!solid?.color) return null;

  const { r, g, b, a: colorA } = solid.color;
  const a = solid.opacity !== undefined ? solid.opacity * colorA : colorA;

  return {
    name: sanitizeName(name),
    hex: toHex(r, g, b, a),
    rgba: {
      r: Math.round(clamp(r, 0, 1) * 255),
      g: Math.round(clamp(g, 0, 1) * 255),
      b: Math.round(clamp(b, 0, 1) * 255),
      a: Number.parseFloat(clamp(a, 0, 1).toFixed(2)),
    },
  };
}

// ---------------------------------------------------------------------------
// Text style → Typography extraction
// ---------------------------------------------------------------------------

function extractTypography(name: string, style: FigmaTypeStyle): TypographyToken {
  return {
    name: sanitizeName(name),
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeightPx ?? null,
    letterSpacing: style.letterSpacing ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Effect → Shadow / Blur extraction
// ---------------------------------------------------------------------------

function extractEffects(name: string, effects: FigmaEffect[]): EffectToken[] {
  const tokens: EffectToken[] = [];

  for (const effect of effects) {
    if (effect.visible === false) continue;

    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      tokens.push({
        name: sanitizeName(name),
        type: effect.type === 'DROP_SHADOW' ? 'drop-shadow' : 'inner-shadow',
        color: effect.color
          ? {
              r: Math.round(clamp(effect.color.r, 0, 1) * 255),
              g: Math.round(clamp(effect.color.g, 0, 1) * 255),
              b: Math.round(clamp(effect.color.b, 0, 1) * 255),
              a: Number.parseFloat(clamp(effect.color.a, 0, 1).toFixed(2)),
            }
          : { r: 0, g: 0, b: 0, a: 1 },
        offsetX: effect.offset?.x ?? 0,
        offsetY: effect.offset?.y ?? 0,
        radius: effect.radius ?? 0,
        spread: effect.spread ?? 0,
      });
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
      tokens.push({
        name: sanitizeName(name),
        type: effect.type === 'LAYER_BLUR' ? 'layer-blur' : 'background-blur',
        radius: effect.radius ?? 0,
      });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Main extractor — works from the full file response (document tree + styles)
// ---------------------------------------------------------------------------

/**
 * Extracts design tokens from a Figma file response.
 *
 * Walks the document tree and matches nodes referenced by the `styles` map.
 * For each style, extracts the relevant token data based on style_type.
 *
 * @param document - The Figma file `document` field (root node tree)
 * @param styles - The `styles` map from the file response (id → style meta)
 * @param filter - Optional filter to extract only specific token types
 */
export function extractTokens(
  document: unknown,
  styles: Record<string, FigmaStyleMeta> | undefined,
  filter?: TokenFilter,
): ExtractedTokens {
  const colors: ColorToken[] = [];
  const typography: TypographyToken[] = [];
  const effects: EffectToken[] = [];

  if (!styles || Object.keys(styles).length === 0) {
    return { colors, typography, effects };
  }

  // Build a lookup: node ID → style meta(s) for that node
  const styleByNodeId = new Map<string, FigmaStyleMeta>();
  for (const [nodeId, meta] of Object.entries(styles)) {
    styleByNodeId.set(nodeId, meta);
  }

  // Walk the document tree to find nodes referenced by styles
  const nodeMap = new Map<string, FigmaNode>();
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as FigmaNode;
    if (n.id) {
      nodeMap.set(n.id, n);
    }
    // Also check if this node has style references (Figma uses `styles` property on nodes)
    const nodeStyles = (n as unknown as { styles?: Record<string, string> }).styles;
    if (nodeStyles) {
      for (const [_styleType, styleId] of Object.entries(nodeStyles)) {
        if (styleByNodeId.has(styleId)) {
          // Map this node to the style's node ID
          nodeMap.set(styleId, n);
        }
      }
    }
    if (Array.isArray(n.children)) {
      for (const child of n.children) walk(child);
    }
  }
  walk(document);

  // Extract tokens from matched nodes
  for (const [nodeId, meta] of styleByNodeId) {
    const node = nodeMap.get(nodeId);
    const styleName = meta.name;

    if (meta.style_type === 'FILL' && (!filter || filter === 'colors')) {
      if (node?.fills && Array.isArray(node.fills)) {
        const color = extractColorFromPaints(styleName, node.fills);
        if (color) colors.push(color);
      }
    } else if (meta.style_type === 'TEXT' && (!filter || filter === 'typography')) {
      if (node?.style) {
        typography.push(extractTypography(styleName, node.style));
      }
    } else if (meta.style_type === 'EFFECT' && (!filter || filter === 'effects')) {
      if (node?.effects && Array.isArray(node.effects)) {
        const extracted = extractEffects(styleName, node.effects);
        effects.push(...extracted);
      }
    }
  }

  return { colors, typography, effects };
}

/**
 * Converts extracted tokens to a flat key-value representation.
 */
export function toFlatTokens(tokens: ExtractedTokens): Record<string, string | number> {
  const flat: Record<string, string | number> = {};

  for (const c of tokens.colors) {
    const key = `color.${slugify(c.name)}`;
    flat[key] = c.hex;
  }

  for (const t of tokens.typography) {
    const base = `typography.${slugify(t.name)}`;
    flat[`${base}.fontFamily`] = t.fontFamily;
    flat[`${base}.fontSize`] = t.fontSize;
    flat[`${base}.fontWeight`] = t.fontWeight;
    if (t.lineHeight !== null) flat[`${base}.lineHeight`] = t.lineHeight;
    flat[`${base}.letterSpacing`] = t.letterSpacing;
  }

  for (const e of tokens.effects) {
    const base = `effect.${slugify(e.name)}`;
    flat[`${base}.type`] = e.type;
    if ('color' in e) {
      const s = e as ShadowToken;
      flat[`${base}.offsetX`] = s.offsetX;
      flat[`${base}.offsetY`] = s.offsetY;
      flat[`${base}.radius`] = s.radius;
      flat[`${base}.spread`] = s.spread;
      flat[`${base}.color`] = `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${s.color.a})`;
    } else {
      flat[`${base}.radius`] = (e as BlurToken).radius;
    }
  }

  return flat;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
