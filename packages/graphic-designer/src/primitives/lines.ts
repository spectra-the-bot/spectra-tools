import type { SKRSContext2D } from '@napi-rs/canvas';

export type Point = { x: number; y: number };

export type LineStyle = {
  color: string;
  width: number;
  dash?: number[];
};

export type ArrowStyle = LineStyle & {
  headSize: number;
};

function applyLineStyle(ctx: SKRSContext2D, style: LineStyle): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.setLineDash(style.dash ?? []);
}

export function drawLine(ctx: SKRSContext2D, from: Point, to: Point, style: LineStyle): void {
  applyLineStyle(ctx, style);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

export function drawArrowhead(
  ctx: SKRSContext2D,
  tip: Point,
  angle: number,
  size: number,
  fill: string,
): void {
  const wing = Math.PI / 7;

  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - size * Math.cos(angle - wing), tip.y - size * Math.sin(angle - wing));
  ctx.lineTo(tip.x - size * Math.cos(angle + wing), tip.y - size * Math.sin(angle + wing));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function drawArrow(
  ctx: SKRSContext2D,
  from: Point,
  to: Point,
  arrow: 'end' | 'start' | 'both' | 'none',
  style: ArrowStyle,
): void {
  drawLine(ctx, from, to, style);

  if (arrow === 'none') {
    return;
  }

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  if (arrow === 'end' || arrow === 'both') {
    drawArrowhead(ctx, to, angle, style.headSize, style.color);
  }
  if (arrow === 'start' || arrow === 'both') {
    drawArrowhead(ctx, from, angle + Math.PI, style.headSize, style.color);
  }
}

export function drawBezier(ctx: SKRSContext2D, points: Point[], style: LineStyle): void {
  if (points.length < 2) {
    return;
  }

  if (points.length === 2) {
    drawLine(ctx, points[0], points[1], style);
    return;
  }

  applyLineStyle(ctx, style);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 4) {
    ctx.bezierCurveTo(
      points[1].x,
      points[1].y,
      points[2].x,
      points[2].y,
      points[3].x,
      points[3].y,
    );
    ctx.stroke();
    return;
  }

  for (let i = 1; i < points.length - 2; i += 1) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
  ctx.stroke();
}

export function drawOrthogonalPath(
  ctx: SKRSContext2D,
  from: Point,
  to: Point,
  style: LineStyle,
): void {
  const midX = (from.x + to.x) / 2;

  applyLineStyle(ctx, style);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(midX, from.y);
  ctx.lineTo(midX, to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
