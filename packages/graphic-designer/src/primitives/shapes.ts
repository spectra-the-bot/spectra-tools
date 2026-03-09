import type { SKRSContext2D } from '@napi-rs/canvas';
import type { Rect } from '../renderer.js';

export function roundRectPath(ctx: SKRSContext2D, rect: Rect, radius: number): void {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(right - r, rect.y);
  ctx.quadraticCurveTo(right, rect.y, right, rect.y + r);
  ctx.lineTo(right, bottom - r);
  ctx.quadraticCurveTo(right, bottom, right - r, bottom);
  ctx.lineTo(rect.x + r, bottom);
  ctx.quadraticCurveTo(rect.x, bottom, rect.x, bottom - r);
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  ctx.closePath();
}

function fillAndStroke(ctx: SKRSContext2D, fill: string, stroke?: string): void {
  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function drawRoundedRect(
  ctx: SKRSContext2D,
  rect: Rect,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  roundRectPath(ctx, rect, radius);
  fillAndStroke(ctx, fill, stroke);
}

export function drawCircle(
  ctx: SKRSContext2D,
  center: { x: number; y: number },
  radius: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.arc(center.x, center.y, Math.max(0, radius), 0, Math.PI * 2);
  ctx.closePath();
  fillAndStroke(ctx, fill, stroke);
}

export function drawDiamond(ctx: SKRSContext2D, bounds: Rect, fill: string, stroke?: string): void {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  ctx.beginPath();
  ctx.moveTo(cx, bounds.y);
  ctx.lineTo(bounds.x + bounds.width, cy);
  ctx.lineTo(cx, bounds.y + bounds.height);
  ctx.lineTo(bounds.x, cy);
  ctx.closePath();
  fillAndStroke(ctx, fill, stroke);
}

export function drawPill(ctx: SKRSContext2D, bounds: Rect, fill: string, stroke?: string): void {
  drawRoundedRect(ctx, bounds, Math.min(bounds.width, bounds.height) / 2, fill, stroke);
}

export function drawEllipse(ctx: SKRSContext2D, bounds: Rect, fill: string, stroke?: string): void {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy,
    Math.max(0, bounds.width / 2),
    Math.max(0, bounds.height / 2),
    0,
    0,
    Math.PI * 2,
  );
  ctx.closePath();
  fillAndStroke(ctx, fill, stroke);
}

export function drawCylinder(
  ctx: SKRSContext2D,
  bounds: Rect,
  fill: string,
  stroke?: string,
): void {
  const rx = Math.max(2, bounds.width / 2);
  const ry = Math.max(2, Math.min(bounds.height * 0.18, 16));
  const cx = bounds.x + bounds.width / 2;
  const topCy = bounds.y + ry;
  const bottomCy = bounds.y + bounds.height - ry;

  ctx.beginPath();
  ctx.moveTo(bounds.x, topCy);
  ctx.ellipse(cx, topCy, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(bounds.x + bounds.width, bottomCy);
  ctx.ellipse(cx, bottomCy, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();

  fillAndStroke(ctx, fill, stroke);

  if (stroke) {
    ctx.beginPath();
    ctx.ellipse(cx, topCy, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function drawParallelogram(
  ctx: SKRSContext2D,
  bounds: Rect,
  fill: string,
  stroke?: string,
  skew?: number,
): void {
  const maxSkew = bounds.width * 0.45;
  const skewX = Math.max(-maxSkew, Math.min(maxSkew, skew ?? bounds.width * 0.18));

  ctx.beginPath();
  ctx.moveTo(bounds.x + skewX, bounds.y);
  ctx.lineTo(bounds.x + bounds.width, bounds.y);
  ctx.lineTo(bounds.x + bounds.width - skewX, bounds.y + bounds.height);
  ctx.lineTo(bounds.x, bounds.y + bounds.height);
  ctx.closePath();
  fillAndStroke(ctx, fill, stroke);
}
