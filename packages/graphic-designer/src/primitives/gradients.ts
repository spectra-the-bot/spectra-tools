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
  stops: GradientStop[];
};

export type GradientSpec = LinearGradientSpec | RadialGradientSpec;

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
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          0,
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          Math.max(rect.width, rect.height) / 2,
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
