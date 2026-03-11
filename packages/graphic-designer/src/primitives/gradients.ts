import type { SKRSContext2D } from '@napi-rs/canvas';
import type { Rect } from '../renderer.js';

export type GradientStop = { offset: number; color: string };

type LinearGradientSpec = {
  type: 'linear';
  angle?: number;
  stops: GradientStop[];
};

type RadialGradientSpec = {
  type: 'radial';
  cx?: number | undefined;
  cy?: number | undefined;
  innerRadius?: number | undefined;
  outerRadius?: number | undefined;
  stops: GradientStop[];
};

export type GradientSpec = LinearGradientSpec | RadialGradientSpec;

/** Default seven-colour rainbow palette used by {@link drawRainbowRule} when no custom colours are provided. */
export const DEFAULT_RAINBOW_COLORS = [
  '#FF6B6B',
  '#FFA94D',
  '#FFD43B',
  '#69DB7C',
  '#4DABF7',
  '#9775FA',
  '#DA77F2',
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeStops(stops: GradientStop[]): GradientStop[] {
  return [...stops]
    .map((stop) => ({
      offset: clamp01(stop.offset),
      color: stop.color,
    }))
    .sort((a, b) => a.offset - b.offset);
}

function addGradientStops(gradient: CanvasGradient, stops: GradientStop[]): void {
  for (const stop of normalizeStops(stops)) {
    gradient.addColorStop(stop.offset, stop.color);
  }
}

function createLinearRectGradient(
  ctx: SKRSContext2D,
  rect: Rect,
  angleDegrees: number,
): CanvasGradient {
  const radians = (angleDegrees * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const halfSpan = Math.max(1, Math.abs(dx) * (rect.width / 2) + Math.abs(dy) * (rect.height / 2));

  return ctx.createLinearGradient(
    cx - dx * halfSpan,
    cy - dy * halfSpan,
    cx + dx * halfSpan,
    cy + dy * halfSpan,
  );
}

function roundedRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function parseHexColor(color: string): { r: number; g: number; b: number; a: number } {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  if (normalized.length !== 6 && normalized.length !== 8) {
    throw new Error(`Expected #RRGGBB or #RRGGBBAA color, received ${color}`);
  }

  const parseChannel = (offset: number): number =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16);

  return {
    r: parseChannel(0),
    g: parseChannel(2),
    b: parseChannel(4),
    a: normalized.length === 8 ? parseChannel(6) / 255 : 1,
  };
}

function withAlpha(color: string, alpha: number): string {
  const parsed = parseHexColor(color);
  const effectiveAlpha = clamp01(parsed.a * alpha);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${effectiveAlpha})`;
}

/**
 * Fill a rectangle with a linear or radial gradient.
 *
 * Supports optional rounded corners via {@link borderRadius}. Linear gradients
 * are rotated around the rectangle's centre according to the spec's `angle`
 * field; radial gradients originate from the centre.
 *
 * @param ctx - The `@napi-rs/canvas` 2D rendering context.
 * @param rect - The target {@link Rect} to fill.
 * @param gradient - A {@link GradientSpec} describing the gradient type, angle
 *   (for linear), and colour stops.
 * @param borderRadius - Corner radius in pixels. Defaults to `0` (sharp
 *   corners).
 */
export function drawGradientRect(
  ctx: SKRSContext2D,
  rect: Rect,
  gradient: GradientSpec,
  borderRadius = 0,
): void {
  const fill =
    gradient.type === 'linear'
      ? createLinearRectGradient(ctx, rect, gradient.angle ?? 180)
      : ctx.createRadialGradient(
          gradient.cx ?? rect.x + rect.width / 2,
          gradient.cy ?? rect.y + rect.height / 2,
          gradient.innerRadius ?? 0,
          gradient.cx ?? rect.x + rect.width / 2,
          gradient.cy ?? rect.y + rect.height / 2,
          gradient.outerRadius ?? Math.max(rect.width, rect.height) / 2,
        );

  addGradientStops(fill, gradient.stops);

  ctx.save();
  ctx.fillStyle = fill;
  if (borderRadius > 0) {
    roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, borderRadius);
    ctx.fill();
  } else {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
}

/**
 * Draw a horizontal rainbow gradient rule (decorative divider line).
 *
 * The rule is centred vertically on {@link y} and spans from {@link x} to
 * `x + width`. When fewer than two colours are supplied the
 * {@link DEFAULT_RAINBOW_COLORS} palette is used as a fallback.
 *
 * @param ctx - The `@napi-rs/canvas` 2D rendering context.
 * @param x - Left edge x-coordinate.
 * @param y - Vertical centre y-coordinate of the rule.
 * @param width - Horizontal width in pixels.
 * @param thickness - Rule thickness in pixels. Defaults to `2`.
 * @param colors - Array of hex colour strings for the gradient stops. Defaults
 *   to {@link DEFAULT_RAINBOW_COLORS}.
 * @param borderRadius - Corner radius. Defaults to half the thickness for a
 *   pill shape.
 */
export function drawRainbowRule(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  thickness = 2,
  colors: string[] = [...DEFAULT_RAINBOW_COLORS],
  borderRadius = thickness / 2,
): void {
  if (width <= 0 || thickness <= 0) {
    return;
  }

  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  const stops = colors.length >= 2 ? colors : [...DEFAULT_RAINBOW_COLORS];

  for (const [index, color] of stops.entries()) {
    gradient.addColorStop(index / (stops.length - 1), color);
  }

  const ruleTop = y - thickness / 2;

  ctx.save();
  roundedRectPath(ctx, x, ruleTop, width, thickness, borderRadius);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a linear edge vignette overlay with top and bottom gradient fades.
 *
 * The top gradient fades from the specified colour at the top edge to
 * transparent. The bottom gradient fades from transparent to the colour at the
 * bottom edge. Heights and opacities are independently configurable.
 *
 * @param ctx - The `@napi-rs/canvas` 2D rendering context.
 * @param width - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 * @param color - Hex colour string for the vignette tint. Defaults to
 *   `'#000000'`.
 * @param topHeight - Height of the top gradient fade in pixels. Defaults to
 *   `35`.
 * @param bottomHeight - Height of the bottom gradient fade in pixels. Defaults
 *   to `55`.
 * @param topOpacity - Opacity of the top edge. Defaults to `0.3`.
 * @param bottomOpacity - Opacity of the bottom edge. Defaults to `0.4`.
 */
export function drawEdgeVignette(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  color = '#000000',
  topHeight = 35,
  bottomHeight = 55,
  topOpacity = 0.3,
  bottomOpacity = 0.4,
): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  if (topHeight > 0 && topOpacity > 0) {
    const topGradient = ctx.createLinearGradient(0, 0, 0, topHeight);
    topGradient.addColorStop(0, withAlpha(color, clamp01(topOpacity)));
    topGradient.addColorStop(1, withAlpha(color, 0));

    ctx.save();
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, width, topHeight);
    ctx.restore();
  }

  if (bottomHeight > 0 && bottomOpacity > 0) {
    const bottomY = height - bottomHeight;
    const bottomGradient = ctx.createLinearGradient(0, bottomY, 0, height);
    bottomGradient.addColorStop(0, withAlpha(color, 0));
    bottomGradient.addColorStop(1, withAlpha(color, clamp01(bottomOpacity)));

    ctx.save();
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, bottomY, width, bottomHeight);
    ctx.restore();
  }
}

/**
 * Draw a radial vignette overlay across the full canvas.
 *
 * The vignette fades from fully transparent at the centre to the specified
 * {@link color} at the edges, controlled by {@link intensity}. It is a no-op
 * when width, height, or intensity are zero or negative.
 *
 * @param ctx - The `@napi-rs/canvas` 2D rendering context.
 * @param width - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 * @param intensity - Opacity of the vignette at the edges, clamped to 0–1.
 *   Defaults to `0.3`.
 * @param color - Hex colour string for the vignette tint. Defaults to
 *   `'#000000'`.
 */
export function drawVignette(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  intensity = 0.3,
  color = '#000000',
): void {
  if (width <= 0 || height <= 0 || intensity <= 0) {
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.max(width, height) / 2;
  const innerRadius = Math.min(width, height) * 0.2;
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    innerRadius,
    centerX,
    centerY,
    outerRadius,
  );

  vignette.addColorStop(0, withAlpha(color, 0));
  vignette.addColorStop(0.6, withAlpha(color, 0));
  vignette.addColorStop(1, withAlpha(color, clamp01(intensity)));

  ctx.save();
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
