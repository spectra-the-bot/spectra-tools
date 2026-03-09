import type { SKRSContext2D } from '@napi-rs/canvas';
import type { Rect } from '../renderer.js';
import { drawRoundedRect } from './shapes.js';
import { applyFont } from './text.js';

export type WindowStyle = 'macos' | 'windows' | 'linux' | 'minimal';

export function drawMacOSButtons(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  const colors = ['#FF5F57', '#FEBC2E', '#28C840'];

  for (const [index, color] of colors.entries()) {
    ctx.beginPath();
    ctx.arc(x + index * (size + 6), y, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export function drawWindowsButtons(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const half = size / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  // minimize
  ctx.beginPath();
  ctx.moveTo(x - half, y + half);
  ctx.lineTo(x + half, y + half);
  ctx.stroke();

  // maximize
  ctx.strokeRect(x + size + 6 - half, y - half + 1, size - 2, size - 2);

  // close
  const closeX = x + (size + 6) * 2;
  ctx.beginPath();
  ctx.moveTo(closeX - half, y - half);
  ctx.lineTo(closeX + half, y + half);
  ctx.moveTo(closeX + half, y - half);
  ctx.lineTo(closeX - half, y + half);
  ctx.stroke();
}

export function drawWindowChrome(
  ctx: SKRSContext2D,
  bounds: Rect,
  style: WindowStyle,
  options: {
    title?: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
  },
): { contentTop: number } {
  const titleBarHeight = style === 'minimal' ? 24 : 30;
  const barRect: Rect = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: titleBarHeight,
  };

  drawRoundedRect(ctx, barRect, 10, options.backgroundColor);

  if (style === 'macos') {
    drawMacOSButtons(ctx, bounds.x + 14, bounds.y + titleBarHeight / 2, 10);
  }

  if (style === 'windows') {
    drawWindowsButtons(
      ctx,
      bounds.x + bounds.width - 52,
      bounds.y + titleBarHeight / 2 - 1,
      10,
      options.textColor,
    );
  }

  if (style === 'linux') {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(bounds.x + 14 + i * 14, bounds.y + titleBarHeight / 2, 4, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#6B7280';
      ctx.fill();
    }
  }

  if (options.title) {
    applyFont(ctx, { size: 12, weight: 600, family: options.fontFamily });
    ctx.fillStyle = options.textColor;
    ctx.textAlign = style === 'minimal' ? 'left' : 'center';
    const titleX = style === 'minimal' ? bounds.x + 10 : bounds.x + bounds.width / 2;
    ctx.fillText(options.title, titleX, bounds.y + titleBarHeight - 10);
    ctx.textAlign = 'left';
  }

  return { contentTop: bounds.y + titleBarHeight };
}
