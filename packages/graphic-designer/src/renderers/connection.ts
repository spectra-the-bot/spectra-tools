import type { SKRSContext2D } from '@napi-rs/canvas';
import type { EdgeRoute } from '../layout/types.js';
import {
  type ArrowStyle,
  type LineStyle,
  type Point as PrimitivePoint,
  drawArrowhead,
  drawOrthogonalPath,
} from '../primitives/lines.js';
import { drawTextLabel, resolveFont } from '../primitives/text.js';
import type { Rect as RendererRect, RenderedElement } from '../renderer.js';
import type { ConnectionElement, Theme } from '../spec.schema.js';

export type Point = PrimitivePoint;
export type Rect = RendererRect;

export type ConnectionRouting = 'auto' | 'orthogonal' | 'curve';
export type ConnectionArrow = 'none' | 'end' | 'start' | 'both';
export type ConnectionStrokeStyle = 'solid' | 'dashed' | 'dotted';

export type ConnectionRenderOptions = {
  fromBounds: Rect;
  toBounds: Rect;
  routing: ConnectionRouting;
  tension: number;
  color: string;
  strokeWidth: number;
  strokeStyle: ConnectionStrokeStyle;
  arrow: ConnectionArrow;
  label?: string;
  diagramCenter: Point;
  elkRoute?: Point[];
};

export function rectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

/**
 * Compute the point where a ray from the center of `bounds` toward `target`
 * exits the bounding rectangle.
 */
export function edgeAnchor(bounds: Rect, target: Point): Point {
  const c = rectCenter(bounds);
  const dx = target.x - c.x;
  const dy = target.y - c.y;

  if (dx === 0 && dy === 0) {
    return { x: c.x, y: c.y - bounds.height / 2 };
  }

  const hw = bounds.width / 2;
  const hh = bounds.height / 2;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  const t = absDx * hh > absDy * hw ? hw / absDx : hh / absDy;

  return { x: c.x + dx * t, y: c.y + dy * t };
}

/**
 * Unit vector pointing outward from `diagramCenter` through `point`.
 */
export function outwardNormal(point: Point, diagramCenter: Point): Point {
  const dx = point.x - diagramCenter.x;
  const dy = point.y - diagramCenter.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Compute a cubic bezier curve that bows outward from the diagram center.
 * Returns `[startPoint, controlPoint1, controlPoint2, endPoint]`.
 */
export function curveRoute(
  fromBounds: Rect,
  toBounds: Rect,
  diagramCenter: Point,
  tension: number,
): [Point, Point, Point, Point] {
  const fromCenter = rectCenter(fromBounds);
  const toCenter = rectCenter(toBounds);

  const p0 = edgeAnchor(fromBounds, toCenter);
  const p3 = edgeAnchor(toBounds, fromCenter);

  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const offset = dist * tension;

  const n0 = outwardNormal(p0, diagramCenter);
  const n3 = outwardNormal(p3, diagramCenter);

  const cp1: Point = { x: p0.x + n0.x * offset, y: p0.y + n0.y * offset };
  const cp2: Point = { x: p3.x + n3.x * offset, y: p3.y + n3.y * offset };

  return [p0, cp1, cp2, p3];
}

/**
 * Compute an orthogonal (right-angle) path between two rectangles.
 * Returns an array of waypoints forming a 3-segment path.
 */
export function orthogonalRoute(fromBounds: Rect, toBounds: Rect): Point[] {
  const fromC = rectCenter(fromBounds);
  const toC = rectCenter(toBounds);

  const p0 = edgeAnchor(fromBounds, toC);
  const p3 = edgeAnchor(toBounds, fromC);

  const midX = (p0.x + p3.x) / 2;

  return [p0, { x: midX, y: p0.y }, { x: midX, y: p3.y }, p3];
}

/** Evaluate cubic bezier at parameter `t`. */
export function bezierPointAt(p0: Point, cp1: Point, cp2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t * t * t * p3.y,
  };
}

/**
 * Compute the centroid of all node bounding boxes. Falls back to the
 * provided `canvasCenter` when no nodes are supplied.
 */
export function computeDiagramCenter(nodeBounds: Rect[], canvasCenter?: Point): Point {
  if (nodeBounds.length === 0) {
    return canvasCenter ?? { x: 0, y: 0 };
  }

  let totalX = 0;
  let totalY = 0;
  for (const bounds of nodeBounds) {
    totalX += bounds.x + bounds.width / 2;
    totalY += bounds.y + bounds.height / 2;
  }

  return {
    x: totalX / nodeBounds.length,
    y: totalY / nodeBounds.length,
  };
}

function dashFromStyle(style: ConnectionStrokeStyle | ConnectionElement['style']): number[] | undefined {
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
  const routing: ConnectionRouting = conn.routing ?? 'auto';
  const strokeStyle: ConnectionStrokeStyle = conn.strokeStyle ?? conn.style ?? 'solid';
  const strokeWidth = conn.width ?? conn.strokeWidth ?? 2;
  const tension = conn.tension ?? 0.35;

  const dash = dashFromStyle(strokeStyle);
  const style: ArrowStyle = {
    color: conn.color ?? theme.borderMuted,
    width: strokeWidth,
    headSize: conn.arrowSize ?? 10,
    ...(dash ? { dash } : {}),
  };

  const labelT = conn.labelPosition === 'start' ? 0.2 : conn.labelPosition === 'end' ? 0.8 : 0.5;

  let linePoints: Point[];
  let startPoint: Point;
  let endPoint: Point;
  let startAngle: number;
  let endAngle: number;
  let labelPoint: Point;

  ctx.save();
  ctx.globalAlpha = conn.opacity;

  if (routing === 'curve') {
    const diagramCenter = computeDiagramCenter([fromBounds, toBounds]);
    const [p0, cp1, cp2, p3] = curveRoute(fromBounds, toBounds, diagramCenter, tension);

    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dash ?? []);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y);
    ctx.stroke();

    linePoints = [p0, cp1, cp2, p3];
    startPoint = p0;
    endPoint = p3;
    startAngle = Math.atan2(p0.y - cp1.y, p0.x - cp1.x);
    endAngle = Math.atan2(p3.y - cp2.y, p3.x - cp2.x);
    labelPoint = bezierPointAt(p0, cp1, cp2, p3, labelT);
  } else {
    linePoints =
      edgeRoute && edgeRoute.points.length >= 2
        ? edgeRoute.points
        : orthogonalRoute(fromBounds, toBounds);

    startPoint = linePoints[0];
    const startSegment = linePoints[1] ?? linePoints[0];
    const endStart = linePoints[linePoints.length - 2] ?? linePoints[0];
    endPoint = linePoints[linePoints.length - 1] ?? linePoints[0];

    startAngle = Math.atan2(startSegment.y - linePoints[0].y, startSegment.x - linePoints[0].x) + Math.PI;
    endAngle = Math.atan2(endPoint.y - endStart.y, endPoint.x - endStart.x);

    if (edgeRoute && edgeRoute.points.length >= 2) {
      drawCubicInterpolatedPath(ctx, linePoints, style);
    } else {
      drawOrthogonalPath(ctx, startPoint, endPoint, style);
    }

    labelPoint = pointAlongPolyline(linePoints, labelT);
  }

  if (!Number.isFinite(startAngle)) {
    startAngle = 0;
  }
  if (!Number.isFinite(endAngle)) {
    endAngle = 0;
  }

  if (conn.arrow === 'start' || conn.arrow === 'both') {
    drawArrowhead(ctx, startPoint, startAngle, style.headSize, style.color);
  }
  if (conn.arrow === 'end' || conn.arrow === 'both') {
    drawArrowhead(ctx, endPoint, endAngle, style.headSize, style.color);
  }

  ctx.restore();

  const elements: RenderedElement[] = [
    {
      id: `connection-${conn.from}-${conn.to}`,
      kind: 'connection',
      bounds: polylineBounds(linePoints),
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
