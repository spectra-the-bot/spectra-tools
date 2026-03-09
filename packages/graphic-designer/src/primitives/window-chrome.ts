import type { SKRSContext2D } from '@napi-rs/canvas';
import type { WindowControls } from '../code-style.js';
import type { Rect } from '../renderer.js';
import { relativeLuminance } from '../utils/color.js';
import { applyFont } from './text.js';

export const WINDOW_CHROME_HEIGHT = 34;
const WINDOW_CHROME_LEFT_MARGIN = 14;
const DOT_RADIUS = 6;
const DOT_SPACING = 20;
const DOT_STROKE_WIDTH = 0.5;

const MACOS_DOTS = [
  { fill: '#FF5F56', stroke: '#E0443E' },
  { fill: '#FFBD2E', stroke: '#DEA123' },
  { fill: '#27C93F', stroke: '#1AAB29' },
] as const;

function drawMacosDots(ctx: SKRSContext2D, x: number, y: number): void {
  for (const [index, dot] of MACOS_DOTS.entries()) {
    ctx.beginPath();
    ctx.arc(x + index * DOT_SPACING, y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = dot.fill;
    ctx.strokeStyle = dot.stroke;
    ctx.lineWidth = DOT_STROKE_WIDTH;
    ctx.fill();
    ctx.stroke();
  }
}

function drawBwDots(ctx: SKRSContext2D, x: number, y: number): void {
  for (let index = 0; index < 3; index += 1) {
    ctx.beginPath();
    ctx.arc(x + index * DOT_SPACING, y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.closePath();
    ctx.strokeStyle = '#878787';
    ctx.lineWidth = DOT_STROKE_WIDTH;
    ctx.stroke();
  }
}

function resolveTitleColor(backgroundColor: string): string {
  try {
    return relativeLuminance(backgroundColor) < 0.4 ? '#FFFFFF' : '#000000';
  } catch {
    return '#FFFFFF';
  }
}

export function drawWindowChrome(
  ctx: SKRSContext2D,
  containerRect: Rect,
  options: {
    style: WindowControls;
    title?: string;
    fontFamily: string;
    backgroundColor: string;
  },
): { contentTop: number; hasChrome: boolean } {
  if (options.style === 'none') {
    return { contentTop: containerRect.y, hasChrome: false };
  }

  const controlsCenterY = containerRect.y + WINDOW_CHROME_HEIGHT / 2;
  const controlsStartX = containerRect.x + WINDOW_CHROME_LEFT_MARGIN + DOT_RADIUS;

  if (options.style === 'macos') {
    drawMacosDots(ctx, controlsStartX, controlsCenterY);
  } else {
    drawBwDots(ctx, controlsStartX, controlsCenterY);
  }

  if (options.title) {
    applyFont(ctx, { size: 14, weight: 500, family: options.fontFamily });
    ctx.fillStyle = resolveTitleColor(options.backgroundColor);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.title, containerRect.x + containerRect.width / 2, controlsCenterY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  return { contentTop: containerRect.y + WINDOW_CHROME_HEIGHT, hasChrome: true };
}
