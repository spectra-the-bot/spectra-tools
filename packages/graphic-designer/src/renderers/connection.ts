import type { SKRSContext2D } from '@napi-rs/canvas';
import type { EdgeRoute } from '../layout/types.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { ConnectionElement, Theme } from '../spec.schema.js';
import {
  type ArrowStyle,
  type LineStyle,
  type Point,
  drawArrowhead,
  drawOrthogonalPath,
} from '../primitives/lines.js';
import { drawTextLabel, resolveFont } from '../primitives/text.js';

function center(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function edgeAnchor(rect: Rect, target: Point): Point {
  const c = center(rect);
  const dx = target.x - c.x;
  const dy = target.y - c.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? rect.x + rect.width : rect.x,
      y: c.y,
    };
  }

  return {
    x: c.x,
    y: dy >= 0 ? rect.y + rect.height : rect.y,
  };
}

function dashFromStyle(style: ConnectionElement['style']): number[] | undefined {
  switch (style) {
    case 'dashed':
      return [10, 6];
    case 'dotted':
      return [2, 6];
    default:
      return undefined;
  }
}

function pointAlongPolyline(points: Point[], t: number): Point {
  if (points.length <= 1) {
    return points[0] ?? { x: 0, y: 0 };
  }

  const lengths: number[] = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    lengths.push(segment);
    total += segment;
  }

  if (total === 0) {
    return points[0];
  }

  let target = total * t;
  for (let i = 0; i < lengths.length; i += 1) {
    if (target > lengths[i]) {
      target -= lengths[i];
      continue;
    }

    const ratio = lengths[i] === 0 ? 0 : target / lengths[i];
    return {
      x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
      y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
    };
  }

  return points[points.length - 1];
}

function drawCubicInterpolatedPath(ctx: SKRSContext2D, points: Point[], style: LineStyle): void {
  if (points.length < 2) {
    return;
  }

  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.setLineDash(style.dash ?? []);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };

    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
  }

  ctx.stroke();
}

function polylineBounds(points: Point[]): Rect {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function renderConnection(
  ctx: SKRSContext2D,
  conn: ConnectionElement,
  fromBounds: Rect,
  toBounds: Rect,
  theme: Theme,
  edgeRoute?: EdgeRoute,
): RenderedElement[] {
  const fromCenter = center(fromBounds);
  const toCenter = center(toBounds);
  const from = edgeAnchor(fromBounds, toCenter);
  const to = edgeAnchor(toBounds, fromCenter);

  const dash = dashFromStyle(conn.style);
  const style: ArrowStyle = {
    color: conn.color ?? theme.borderMuted,
    width: conn.width ?? 2,
    headSize: conn.arrowSize ?? 10,
    ...(dash ? { dash } : {}),
  };

  const points =
    edgeRoute && edgeRoute.points.length >= 2
      ? edgeRoute.points
      : [
          from,
          { x: (from.x + to.x) / 2, y: from.y },
          { x: (from.x + to.x) / 2, y: to.y },
          to,
        ];

  const startSegment = points[1] ?? points[0];
  const endStart = points[points.length - 2] ?? points[0];
  const end = points[points.length - 1] ?? points[0];

  let startAngle = Math.atan2(startSegment.y - points[0].y, startSegment.x - points[0].x) + Math.PI;
  let endAngle = Math.atan2(end.y - endStart.y, end.x - endStart.x);
  if (!Number.isFinite(startAngle)) {
    startAngle = 0;
  }
  if (!Number.isFinite(endAngle)) {
    endAngle = 0;
  }

  const t = conn.labelPosition === 'start' ? 0.2 : conn.labelPosition === 'end' ? 0.8 : 0.5;
  const labelPoint = pointAlongPolyline(points, t);

  ctx.save();
  ctx.globalAlpha = conn.opacity;

  if (edgeRoute && edgeRoute.points.length >= 2) {
    drawCubicInterpolatedPath(ctx, points, style);
  } else {
    drawOrthogonalPath(ctx, points[0], points[points.length - 1], style);
  }

  if (conn.arrow === 'start' || conn.arrow === 'both') {
    drawArrowhead(ctx, points[0], startAngle, style.headSize, style.color);
  }
  if (conn.arrow === 'end' || conn.arrow === 'both') {
    drawArrowhead(ctx, end, endAngle, style.headSize, style.color);
  }

  ctx.restore();

  const elements: RenderedElement[] = [
    {
      id: `connection-${conn.from}-${conn.to}`,
      kind: 'connection',
      bounds: polylineBounds(points),
      foregroundColor: style.color,
    },
  ];

  if (conn.label) {
    ctx.save();
    ctx.globalAlpha = conn.opacity;

    const labelRect = drawTextLabel(ctx, conn.label, labelPoint, {
      fontSize: 12,
      fontFamily: resolveFont(theme.fonts.body, 'body'),
      color: theme.text,
      backgroundColor: theme.background,
      padding: 6,
      borderRadius: 8,
    });

    ctx.restore();

    elements.push({
      id: `connection-${conn.from}-${conn.to}-label`,
      kind: 'text',
      bounds: labelRect,
      foregroundColor: theme.text,
      backgroundColor: theme.background,
    });
  }

  return elements;
}
