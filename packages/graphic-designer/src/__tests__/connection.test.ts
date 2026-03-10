import { describe, expect, it } from 'vitest';
import {
  type Point,
  type Rect,
  bezierPointAt,
  computeDiagramCenter,
  curveRoute,
  edgeAnchor,
  orthogonalRoute,
  outwardNormal,
  rectCenter,
} from '../renderers/connection.js';
import {
  connectionElementSchema,
  diagramSpecSchema,
  flowNodeElementSchema,
  parseDiagramSpec,
} from '../spec.schema.js';

/* ── Schema validation ────────────────────────────────────────── */

describe('connectionElementSchema', () => {
  it('parses a minimal connection with defaults', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
    });
    expect(result.routing).toBe('auto');
    expect(result.tension).toBe(0.35);
    expect(result.arrow).toBe('end');
    expect(result.strokeStyle).toBe('solid');
    expect(result.strokeWidth).toBe(2);
  });

  it('parses a connection with routing: curve', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      routing: 'curve',
      tension: 0.5,
      color: '#7c3aed',
    });
    expect(result.routing).toBe('curve');
    expect(result.tension).toBe(0.5);
  });

  it('parses routing: orthogonal', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      routing: 'orthogonal',
    });
    expect(result.routing).toBe('orthogonal');
  });

  it('rejects invalid routing value', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        routing: 'diagonal',
      }),
    ).toThrow();
  });

  it('rejects tension below minimum (0.1)', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        tension: 0.05,
      }),
    ).toThrow();
  });

  it('rejects tension above maximum (0.8)', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        tension: 0.9,
      }),
    ).toThrow();
  });

  it('accepts all stroke styles', () => {
    for (const style of ['solid', 'dashed', 'dotted'] as const) {
      const result = connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        strokeStyle: style,
      });
      expect(result.strokeStyle).toBe(style);
    }
  });

  it('accepts all arrow modes', () => {
    for (const arrow of ['none', 'end', 'start', 'both'] as const) {
      const result = connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        arrow,
      });
      expect(result.arrow).toBe(arrow);
    }
  });
});

describe('flowNodeElementSchema', () => {
  it('parses a minimal flow node', () => {
    const result = flowNodeElementSchema.parse({
      type: 'flow-node',
      id: 'a',
      label: 'Step A',
    });
    expect(result.shape).toBe('rounded-box');
    expect(result.id).toBe('a');
  });

  it('parses with explicit shape', () => {
    const result = flowNodeElementSchema.parse({
      type: 'flow-node',
      id: 'b',
      label: 'Decision',
      shape: 'diamond',
      color: '#FF0000',
    });
    expect(result.shape).toBe('diamond');
  });
});

describe('diagramSpecSchema', () => {
  const validSpec = {
    version: 1,
    canvas: { width: 800, height: 600 },
    elements: [
      { type: 'flow-node', id: 'a', label: 'A' },
      { type: 'flow-node', id: 'b', label: 'B' },
      {
        type: 'connection',
        from: 'a',
        to: 'b',
        routing: 'curve',
        tension: 0.35,
      },
    ],
    layout: {
      mode: 'manual',
      positions: {
        a: { x: 100, y: 100, width: 180, height: 80 },
        b: { x: 500, y: 300, width: 180, height: 80 },
      },
    },
  };

  it('parses a valid diagram spec', () => {
    const result = parseDiagramSpec(validSpec);
    expect(result.elements).toHaveLength(3);
    expect(result.layout.mode).toBe('manual');
  });

  it('defaults canvas dimensions', () => {
    const result = parseDiagramSpec({
      version: 1,
      canvas: {},
      elements: [{ type: 'flow-node', id: 'x', label: 'X' }],
      layout: { mode: 'manual' },
    });
    expect(result.canvas.width).toBe(1200);
    expect(result.canvas.height).toBe(675);
  });

  it('backward compat: auto routing is default', () => {
    const result = parseDiagramSpec({
      version: 1,
      canvas: { width: 800, height: 600 },
      elements: [
        { type: 'flow-node', id: 'a', label: 'A' },
        { type: 'connection', from: 'a', to: 'a' },
      ],
      layout: { mode: 'manual' },
    });
    const conn = result.elements.find((e) => e.type === 'connection');
    expect(conn).toBeDefined();
    if (conn?.type === 'connection') {
      expect(conn.routing).toBe('auto');
      expect(conn.tension).toBe(0.35);
    }
  });
});

/* ── Geometry helpers ─────────────────────────────────────────── */

describe('rectCenter', () => {
  it('computes center of a rectangle', () => {
    const c = rectCenter({ x: 100, y: 100, width: 200, height: 100 });
    expect(c.x).toBe(200);
    expect(c.y).toBe(150);
  });
});

describe('edgeAnchor', () => {
  const bounds: Rect = { x: 100, y: 100, width: 200, height: 100 };

  it('returns point on right edge when target is to the right', () => {
    const anchor = edgeAnchor(bounds, { x: 500, y: 150 });
    expect(anchor.x).toBeCloseTo(300);
    expect(anchor.y).toBeCloseTo(150);
  });

  it('returns point on bottom edge when target is below', () => {
    const anchor = edgeAnchor(bounds, { x: 200, y: 500 });
    expect(anchor.x).toBeCloseTo(200);
    expect(anchor.y).toBeCloseTo(200);
  });

  it('returns point on left edge when target is to the left', () => {
    const anchor = edgeAnchor(bounds, { x: 0, y: 150 });
    expect(anchor.x).toBeCloseTo(100);
    expect(anchor.y).toBeCloseTo(150);
  });

  it('returns point on top edge when target is above', () => {
    const anchor = edgeAnchor(bounds, { x: 200, y: 0 });
    expect(anchor.x).toBeCloseTo(200);
    expect(anchor.y).toBeCloseTo(100);
  });

  it('defaults to top when target is at center', () => {
    const anchor = edgeAnchor(bounds, { x: 200, y: 150 });
    expect(anchor.x).toBe(200);
    expect(anchor.y).toBe(100);
  });
});

describe('outwardNormal', () => {
  it('returns unit vector pointing away from center', () => {
    const n = outwardNormal({ x: 300, y: 200 }, { x: 200, y: 200 });
    expect(n.x).toBeCloseTo(1);
    expect(n.y).toBeCloseTo(0);
  });

  it('handles diagonal direction', () => {
    const n = outwardNormal({ x: 300, y: 300 }, { x: 200, y: 200 });
    const len = Math.hypot(n.x, n.y);
    expect(len).toBeCloseTo(1);
    expect(n.x).toBeGreaterThan(0);
    expect(n.y).toBeGreaterThan(0);
  });

  it('returns safe fallback when point equals center', () => {
    const n = outwardNormal({ x: 200, y: 200 }, { x: 200, y: 200 });
    const len = Math.hypot(n.x, n.y);
    expect(len).toBeCloseTo(0);
  });
});

/* ── Curve routing ────────────────────────────────────────────── */

describe('curveRoute', () => {
  const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
  const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };
  const diagramCenter: Point = { x: 400, y: 300 };

  it('returns four points [p0, cp1, cp2, p3]', () => {
    const result = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);
    expect(result).toHaveLength(4);
    for (const pt of result) {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('start point lies on fromBounds edge', () => {
    const [p0] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);
    // p0 should be on or very near the edge of fromBounds
    const onHoriz =
      Math.abs(p0.x - fromBounds.x) < 0.01 ||
      Math.abs(p0.x - (fromBounds.x + fromBounds.width)) < 0.01;
    const onVert =
      Math.abs(p0.y - fromBounds.y) < 0.01 ||
      Math.abs(p0.y - (fromBounds.y + fromBounds.height)) < 0.01;
    expect(onHoriz || onVert).toBe(true);
  });

  it('end point lies on toBounds edge', () => {
    const [, , , p3] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);
    const onHoriz =
      Math.abs(p3.x - toBounds.x) < 0.01 || Math.abs(p3.x - (toBounds.x + toBounds.width)) < 0.01;
    const onVert =
      Math.abs(p3.y - toBounds.y) < 0.01 || Math.abs(p3.y - (toBounds.y + toBounds.height)) < 0.01;
    expect(onHoriz || onVert).toBe(true);
  });

  it('control points bow outward from diagram center', () => {
    const [p0, cp1, cp2, p3] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);

    // cp1 should be further from diagramCenter than p0
    const p0Dist = Math.hypot(p0.x - diagramCenter.x, p0.y - diagramCenter.y);
    const cp1Dist = Math.hypot(cp1.x - diagramCenter.x, cp1.y - diagramCenter.y);
    expect(cp1Dist).toBeGreaterThan(p0Dist);

    // cp2 should be further from diagramCenter than p3
    const p3Dist = Math.hypot(p3.x - diagramCenter.x, p3.y - diagramCenter.y);
    const cp2Dist = Math.hypot(cp2.x - diagramCenter.x, cp2.y - diagramCenter.y);
    expect(cp2Dist).toBeGreaterThan(p3Dist);
  });

  it('higher tension produces more dramatic curves', () => {
    const [, cp1Low] = curveRoute(fromBounds, toBounds, diagramCenter, 0.2);
    const [, cp1High] = curveRoute(fromBounds, toBounds, diagramCenter, 0.5);

    // Higher tension → control points further from the straight path
    const lowDist = Math.hypot(cp1Low.x - diagramCenter.x, cp1Low.y - diagramCenter.y);
    const highDist = Math.hypot(cp1High.x - diagramCenter.x, cp1High.y - diagramCenter.y);
    expect(highDist).toBeGreaterThan(lowDist);
  });
});

/* ── Orthogonal routing ───────────────────────────────────────── */

describe('orthogonalRoute', () => {
  it('returns 4 waypoints forming a right-angle path', () => {
    const from: Rect = { x: 100, y: 100, width: 180, height: 80 };
    const to: Rect = { x: 500, y: 300, width: 180, height: 80 };
    const points = orthogonalRoute(from, to);

    expect(points).toHaveLength(4);
    // Middle two points share x (vertical segment)
    expect(points[1].x).toBeCloseTo(points[2].x);
    // First segment is horizontal (same y as start)
    expect(points[1].y).toBeCloseTo(points[0].y);
    // Last segment is horizontal (same y as end)
    expect(points[2].y).toBeCloseTo(points[3].y);
  });
});

/* ── Bezier math ──────────────────────────────────────────────── */

describe('bezierPointAt', () => {
  const p0: Point = { x: 0, y: 0 };
  const cp1: Point = { x: 100, y: 0 };
  const cp2: Point = { x: 100, y: 100 };
  const p3: Point = { x: 0, y: 100 };

  it('returns start point at t=0', () => {
    const pt = bezierPointAt(p0, cp1, cp2, p3, 0);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(0);
  });

  it('returns end point at t=1', () => {
    const pt = bezierPointAt(p0, cp1, cp2, p3, 1);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(100);
  });

  it('returns midpoint at t=0.5', () => {
    const pt = bezierPointAt(p0, cp1, cp2, p3, 0.5);
    // For this curve, midpoint should be offset right
    expect(pt.x).toBeGreaterThan(0);
    expect(pt.y).toBeCloseTo(50);
  });
});

/* ── Diagram center ───────────────────────────────────────────── */

describe('computeDiagramCenter', () => {
  it('computes centroid of multiple nodes', () => {
    const nodes: Rect[] = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 200, y: 0, width: 100, height: 100 },
      { x: 100, y: 200, width: 100, height: 100 },
    ];
    const center = computeDiagramCenter(nodes);
    expect(center.x).toBeCloseTo(150);
    // centers: (50, 50), (250, 50), (150, 250) → avg y = (50+50+250)/3 ≈ 116.67
    expect(center.y).toBeCloseTo(350 / 3);
  });

  it('falls back to canvas center when no nodes', () => {
    const center = computeDiagramCenter([], { x: 600, y: 400 });
    expect(center.x).toBe(600);
    expect(center.y).toBe(400);
  });

  it('falls back to origin when no nodes and no canvas center', () => {
    const center = computeDiagramCenter([]);
    expect(center.x).toBe(0);
    expect(center.y).toBe(0);
  });
});
