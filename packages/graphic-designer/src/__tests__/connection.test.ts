import { describe, expect, it } from 'vitest';
import {
  type EllipseParams,
  type Point,
  type Rect,
  arcRoute,
  bezierPointAt,
  bezierTangentAt,
  computeDiagramCenter,
  curveRoute,
  edgeAnchor,
  ellipseRoute,
  findBoundaryIntersection,
  inferEllipseParams,
  isInsideRect,
  orthogonalRoute,
  outwardNormal,
  rectCenter,
  resolveAnchor,
  straightRoute,
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
    expect(result.curveMode).toBe('normal');
    expect(result.tension).toBe(0.35);
    expect(result.arrow).toBe('end');
    expect(result.style).toBe('solid');
    expect(result.strokeStyle).toBeUndefined();
    expect(result.strokeWidth).toBe(2);
    expect(result.arrowPlacement).toBe('endpoint');
  });

  it('defaults arrowPlacement to endpoint', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
    });
    expect(result.arrowPlacement).toBe('endpoint');
  });

  it('parses optional fromColor and toColor', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      color: '#7AA2FF',
      fromColor: '#F97316',
      toColor: '#22C55E',
    });

    expect(result.color).toBe('#7AA2FF');
    expect(result.fromColor).toBe('#F97316');
    expect(result.toColor).toBe('#22C55E');
  });

  it('parses arrowPlacement: boundary', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      arrowPlacement: 'boundary',
    });
    expect(result.arrowPlacement).toBe('boundary');
  });

  it('parses arrowPlacement: endpoint explicitly', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      arrowPlacement: 'endpoint',
    });
    expect(result.arrowPlacement).toBe('endpoint');
  });

  it('rejects invalid arrowPlacement value', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        arrowPlacement: 'center',
      }),
    ).toThrow();
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

  it('parses routing: arc', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      routing: 'arc',
    });
    expect(result.routing).toBe('arc');
  });

  it('parses routing: straight', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      routing: 'straight',
    });
    expect(result.routing).toBe('straight');
  });

  it('defaults curveMode to normal', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
    });
    expect(result.curveMode).toBe('normal');
  });

  it('parses curveMode: ellipse', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      routing: 'curve',
      curveMode: 'ellipse',
    });
    expect(result.curveMode).toBe('ellipse');
  });

  it('rejects invalid curveMode value', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        curveMode: 'arc',
      }),
    ).toThrow();
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

  it('accepts all stroke styles via style field', () => {
    for (const s of ['solid', 'dashed', 'dotted'] as const) {
      const result = connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        style: s,
      });
      expect(result.style).toBe(s);
    }
  });

  it('accepts all stroke styles via deprecated strokeStyle field', () => {
    for (const s of ['solid', 'dashed', 'dotted'] as const) {
      const result = connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        strokeStyle: s,
      });
      expect(result.strokeStyle).toBe(s);
    }
  });

  it('strokeStyle is undefined when not explicitly provided', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
    });
    expect(result.strokeStyle).toBeUndefined();
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

  it('accepts named fromAnchor values', () => {
    for (const anchor of ['top', 'bottom', 'left', 'right', 'center'] as const) {
      const result = connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        fromAnchor: anchor,
      });
      expect(result.fromAnchor).toBe(anchor);
    }
  });

  it('accepts named toAnchor values', () => {
    for (const anchor of ['top', 'bottom', 'left', 'right', 'center'] as const) {
      const result = connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        toAnchor: anchor,
      });
      expect(result.toAnchor).toBe(anchor);
    }
  });

  it('accepts fractional fromAnchor object', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      fromAnchor: { x: 0.5, y: -0.5 },
    });
    expect(result.fromAnchor).toEqual({ x: 0.5, y: -0.5 });
  });

  it('accepts fractional toAnchor object', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      toAnchor: { x: -1, y: 1 },
    });
    expect(result.toAnchor).toEqual({ x: -1, y: 1 });
  });

  it('accepts both fromAnchor and toAnchor simultaneously', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      fromAnchor: 'top',
      toAnchor: { x: 0, y: 1 },
    });
    expect(result.fromAnchor).toBe('top');
    expect(result.toAnchor).toEqual({ x: 0, y: 1 });
  });

  it('defaults fromAnchor and toAnchor to undefined', () => {
    const result = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
    });
    expect(result.fromAnchor).toBeUndefined();
    expect(result.toAnchor).toBeUndefined();
  });

  it('rejects invalid named anchor value', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        fromAnchor: 'top-left',
      }),
    ).toThrow();
  });

  it('rejects fractional anchor x out of range', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        fromAnchor: { x: 1.5, y: 0 },
      }),
    ).toThrow();
  });

  it('rejects fractional anchor y out of range', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        toAnchor: { x: 0, y: -1.5 },
      }),
    ).toThrow();
  });

  it('rejects fractional anchor with extra properties', () => {
    expect(() =>
      connectionElementSchema.parse({
        type: 'connection',
        from: 'a',
        to: 'b',
        fromAnchor: { x: 0, y: 0, z: 0 },
      }),
    ).toThrow();
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

  it('accepts layout.diagramCenter override', () => {
    const result = parseDiagramSpec({
      version: 1,
      canvas: { width: 800, height: 600 },
      elements: [
        { type: 'flow-node', id: 'a', label: 'A' },
        { type: 'flow-node', id: 'b', label: 'B' },
        { type: 'connection', from: 'a', to: 'b', routing: 'arc' },
      ],
      layout: {
        mode: 'manual',
        diagramCenter: { x: 420, y: 250 },
        positions: {
          a: { x: 100, y: 120, width: 180, height: 80 },
          b: { x: 520, y: 120, width: 180, height: 80 },
        },
      },
    });

    expect(result.layout.diagramCenter).toEqual({ x: 420, y: 250 });
  });

  it('accepts layout.ellipseRx and ellipseRy', () => {
    const result = parseDiagramSpec({
      version: 1,
      canvas: { width: 1200, height: 800 },
      elements: [
        { type: 'flow-node', id: 'a', label: 'A' },
        { type: 'flow-node', id: 'b', label: 'B' },
        {
          type: 'connection',
          from: 'a',
          to: 'b',
          routing: 'curve',
          curveMode: 'ellipse',
        },
      ],
      layout: {
        mode: 'manual',
        diagramCenter: { x: 600, y: 355 },
        ellipseRx: 395,
        ellipseRy: 195,
        positions: {
          a: { x: 100, y: 120, width: 155, height: 62 },
          b: { x: 520, y: 120, width: 155, height: 62 },
        },
      },
    });

    expect(result.layout.diagramCenter).toEqual({ x: 600, y: 355 });
    if ('ellipseRx' in result.layout) {
      expect(result.layout.ellipseRx).toBe(395);
    }
    if ('ellipseRy' in result.layout) {
      expect(result.layout.ellipseRy).toBe(195);
    }
  });

  it('parses curveMode in connection elements', () => {
    const result = parseDiagramSpec({
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
          curveMode: 'ellipse',
        },
      ],
      layout: { mode: 'manual' },
    });

    const conn = result.elements.find((e) => e.type === 'connection');
    expect(conn).toBeDefined();
    if (conn?.type === 'connection') {
      expect(conn.routing).toBe('curve');
      expect(conn.curveMode).toBe('ellipse');
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

/* ── resolveAnchor ────────────────────────────────────────────── */

describe('resolveAnchor', () => {
  const bounds: Rect = { x: 100, y: 100, width: 200, height: 100 };
  // center is (200, 150)

  it('falls back to edgeAnchor when anchor is undefined', () => {
    const fallbackTarget: Point = { x: 500, y: 150 };
    const result = resolveAnchor(bounds, undefined, fallbackTarget);
    const expected = edgeAnchor(bounds, fallbackTarget);
    expect(result.x).toBeCloseTo(expected.x);
    expect(result.y).toBeCloseTo(expected.y);
  });

  it('resolves named anchor: top', () => {
    const result = resolveAnchor(bounds, 'top', { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(200); // center x
    expect(result.y).toBeCloseTo(100); // bounds.y
  });

  it('resolves named anchor: bottom', () => {
    const result = resolveAnchor(bounds, 'bottom', { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(200); // center x
    expect(result.y).toBeCloseTo(200); // bounds.y + bounds.height
  });

  it('resolves named anchor: left', () => {
    const result = resolveAnchor(bounds, 'left', { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(100); // bounds.x
    expect(result.y).toBeCloseTo(150); // center y
  });

  it('resolves named anchor: right', () => {
    const result = resolveAnchor(bounds, 'right', { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(300); // bounds.x + bounds.width
    expect(result.y).toBeCloseTo(150); // center y
  });

  it('resolves named anchor: center', () => {
    const result = resolveAnchor(bounds, 'center', { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(150);
  });

  it('resolves fractional anchor (0, 0) to center', () => {
    const result = resolveAnchor(bounds, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(150);
  });

  it('resolves fractional anchor (1, 0) to right edge center', () => {
    const result = resolveAnchor(bounds, { x: 1, y: 0 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(300); // center.x + 1 * width/2
    expect(result.y).toBeCloseTo(150); // center.y
  });

  it('resolves fractional anchor (-1, -1) to top-left corner', () => {
    const result = resolveAnchor(bounds, { x: -1, y: -1 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(100); // center.x - 1 * width/2
    expect(result.y).toBeCloseTo(100); // center.y - 1 * height/2
  });

  it('resolves fractional anchor (1, 1) to bottom-right corner', () => {
    const result = resolveAnchor(bounds, { x: 1, y: 1 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(300); // center.x + 1 * width/2
    expect(result.y).toBeCloseTo(200); // center.y + 1 * height/2
  });

  it('resolves fractional anchor (0.5, -0.5) to quarter offsets', () => {
    const result = resolveAnchor(bounds, { x: 0.5, y: -0.5 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(250); // 200 + 0.5 * 100
    expect(result.y).toBeCloseTo(125); // 150 - 0.5 * 50
  });
});

/* ── resolveAnchor in routing functions ───────────────────────── */

describe('anchor hints in routing functions', () => {
  const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
  const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };
  const diagramCenter: Point = { x: 400, y: 300 };

  it('curveRoute without anchors matches original behavior', () => {
    const withAnchors = curveRoute(fromBounds, toBounds, diagramCenter, 0.35, undefined, undefined);
    const withoutAnchors = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);
    for (let i = 0; i < 4; i++) {
      expect(withAnchors[i].x).toBeCloseTo(withoutAnchors[i].x);
      expect(withAnchors[i].y).toBeCloseTo(withoutAnchors[i].y);
    }
  });

  it('curveRoute with fromAnchor "top" starts from top edge center', () => {
    const [p0] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35, 'top');
    expect(p0.x).toBeCloseTo(190); // fromBounds center x
    expect(p0.y).toBeCloseTo(100); // fromBounds.y (top)
  });

  it('curveRoute with toAnchor "left" ends at left edge center', () => {
    const [, , , p3] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35, undefined, 'left');
    expect(p3.x).toBeCloseTo(500); // toBounds.x (left)
    expect(p3.y).toBeCloseTo(340); // toBounds center y
  });

  it('arcRoute without anchors matches original behavior', () => {
    const withAnchors = arcRoute(fromBounds, toBounds, diagramCenter, 0.35, undefined, undefined);
    const withoutAnchors = arcRoute(fromBounds, toBounds, diagramCenter, 0.35);
    // Compare start and end points
    expect(withAnchors[0][0].x).toBeCloseTo(withoutAnchors[0][0].x);
    expect(withAnchors[0][0].y).toBeCloseTo(withoutAnchors[0][0].y);
    expect(withAnchors[1][3].x).toBeCloseTo(withoutAnchors[1][3].x);
    expect(withAnchors[1][3].y).toBeCloseTo(withoutAnchors[1][3].y);
  });

  it('arcRoute with fromAnchor "bottom" starts from bottom edge', () => {
    const [first] = arcRoute(fromBounds, toBounds, diagramCenter, 0.35, 'bottom');
    expect(first[0].x).toBeCloseTo(190); // fromBounds center x
    expect(first[0].y).toBeCloseTo(180); // fromBounds.y + height
  });

  it('orthogonalRoute without anchors matches original behavior', () => {
    const withAnchors = orthogonalRoute(fromBounds, toBounds, undefined, undefined);
    const withoutAnchors = orthogonalRoute(fromBounds, toBounds);
    expect(withAnchors).toHaveLength(withoutAnchors.length);
    for (let i = 0; i < withAnchors.length; i++) {
      expect(withAnchors[i].x).toBeCloseTo(withoutAnchors[i].x);
      expect(withAnchors[i].y).toBeCloseTo(withoutAnchors[i].y);
    }
  });

  it('orthogonalRoute with fromAnchor "right" starts from right edge', () => {
    const points = orthogonalRoute(fromBounds, toBounds, 'right');
    expect(points[0].x).toBeCloseTo(280); // fromBounds.x + width
    expect(points[0].y).toBeCloseTo(140); // fromBounds center y
  });

  it('orthogonalRoute with toAnchor fractional anchor', () => {
    const points = orthogonalRoute(fromBounds, toBounds, undefined, { x: 0, y: -1 });
    const lastPoint = points[points.length - 1];
    expect(lastPoint.x).toBeCloseTo(590); // toBounds center x
    expect(lastPoint.y).toBeCloseTo(300); // toBounds.y (top)
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

/* ── Arc routing ──────────────────────────────────────────────── */

describe('arcRoute', () => {
  const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
  const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };

  it('returns two cubic segments (kappa ellipse approximation)', () => {
    const segments = arcRoute(fromBounds, toBounds, { x: 400, y: 300 }, 0.35);
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      expect(segment).toHaveLength(4);
      for (const point of segment) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it('changes bow direction when diagramCenter override is on the opposite side', () => {
    const [defaultFirst] = arcRoute(fromBounds, toBounds, { x: 390, y: 20 }, 0.35);
    const [overrideFirst] = arcRoute(fromBounds, toBounds, { x: 390, y: 700 }, 0.35);

    // midpoint of first segment is the segment end (pMid) for this split
    const defaultTop = defaultFirst[3];
    const overrideTop = overrideFirst[3];

    expect(overrideTop.y).toBeLessThan(defaultTop.y);
  });

  it('start/end tangents are perpendicular to the chord in opposite directions', () => {
    const [first, second] = arcRoute(fromBounds, toBounds, { x: 400, y: 300 }, 0.35);
    const start = first[0];
    const startCp = first[1];
    const endCp = second[2];
    const end = second[3];

    const chord = { x: end.x - start.x, y: end.y - start.y };
    const startTan = { x: startCp.x - start.x, y: startCp.y - start.y };
    const endTan = { x: end.x - endCp.x, y: end.y - endCp.y };

    const startDot = chord.x * startTan.x + chord.y * startTan.y;
    const endDot = chord.x * endTan.x + chord.y * endTan.y;

    expect(Math.abs(startDot)).toBeLessThan(1e-6);
    expect(Math.abs(endDot)).toBeLessThan(1e-6);
    expect(startTan.x * endTan.x + startTan.y * endTan.y).toBeLessThan(0);
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

/* ── Bezier tangent ───────────────────────────────────────────── */

describe('bezierTangentAt', () => {
  // Straight-line bezier: p0=(0,0), cp1=(100,0), cp2=(200,0), p3=(300,0)
  const p0: Point = { x: 0, y: 0 };
  const cp1: Point = { x: 100, y: 0 };
  const cp2: Point = { x: 200, y: 0 };
  const p3: Point = { x: 300, y: 0 };

  it('returns a purely horizontal tangent for a horizontal line', () => {
    const tan = bezierTangentAt(p0, cp1, cp2, p3, 0.5);
    expect(tan.x).toBeGreaterThan(0);
    expect(tan.y).toBeCloseTo(0);
  });

  it('returns correct tangent at t=0 (should be 3*(cp1 - p0))', () => {
    const tan = bezierTangentAt(p0, cp1, cp2, p3, 0);
    // At t=0: 3*(1)^2*(cp1-p0) = 3*(100,0) = (300,0)
    expect(tan.x).toBeCloseTo(300);
    expect(tan.y).toBeCloseTo(0);
  });

  it('returns correct tangent at t=1 (should be 3*(p3 - cp2))', () => {
    const tan = bezierTangentAt(p0, cp1, cp2, p3, 1);
    // At t=1: 3*(1)^2*(p3-cp2) = 3*(100,0) = (300,0)
    expect(tan.x).toBeCloseTo(300);
    expect(tan.y).toBeCloseTo(0);
  });

  it('returns correct tangent for a known C-shaped curve', () => {
    // C-shaped curve: starts going right, curves down, ends going left
    const cP0: Point = { x: 0, y: 0 };
    const cCp1: Point = { x: 100, y: 0 };
    const cCp2: Point = { x: 100, y: 100 };
    const cP3: Point = { x: 0, y: 100 };

    // At t=0: tangent = 3*(cp1 - p0) = (300, 0) — pointing right
    const tan0 = bezierTangentAt(cP0, cCp1, cCp2, cP3, 0);
    expect(tan0.x).toBeCloseTo(300);
    expect(tan0.y).toBeCloseTo(0);

    // At t=1: tangent = 3*(p3 - cp2) = (-300, 0) — pointing left
    const tan1 = bezierTangentAt(cP0, cCp1, cCp2, cP3, 1);
    expect(tan1.x).toBeCloseTo(-300);
    expect(tan1.y).toBeCloseTo(0);

    // At t=0.5: tangent should point downward (positive y)
    const tanMid = bezierTangentAt(cP0, cCp1, cCp2, cP3, 0.5);
    expect(tanMid.y).toBeGreaterThan(0);
  });

  it('tangent is consistent with numerical derivative of bezierPointAt', () => {
    const cP0: Point = { x: 0, y: 0 };
    const cCp1: Point = { x: 50, y: 200 };
    const cCp2: Point = { x: 150, y: -100 };
    const cP3: Point = { x: 300, y: 50 };

    const t = 0.4;
    const dt = 1e-6;
    const pBefore = bezierPointAt(cP0, cCp1, cCp2, cP3, t - dt);
    const pAfter = bezierPointAt(cP0, cCp1, cCp2, cP3, t + dt);
    const numericalTan: Point = {
      x: (pAfter.x - pBefore.x) / (2 * dt),
      y: (pAfter.y - pBefore.y) / (2 * dt),
    };

    const analyticTan = bezierTangentAt(cP0, cCp1, cCp2, cP3, t);
    expect(analyticTan.x).toBeCloseTo(numericalTan.x, 2);
    expect(analyticTan.y).toBeCloseTo(numericalTan.y, 2);
  });
});

/* ── isInsideRect ─────────────────────────────────────────────── */

describe('isInsideRect', () => {
  const rect: Rect = { x: 100, y: 100, width: 200, height: 100 };

  it('returns true for a point in the center', () => {
    expect(isInsideRect({ x: 200, y: 150 }, rect)).toBe(true);
  });

  it('returns true for a point on the left boundary', () => {
    expect(isInsideRect({ x: 100, y: 150 }, rect)).toBe(true);
  });

  it('returns true for a point on the right boundary', () => {
    expect(isInsideRect({ x: 300, y: 150 }, rect)).toBe(true);
  });

  it('returns true for a point on the top boundary', () => {
    expect(isInsideRect({ x: 200, y: 100 }, rect)).toBe(true);
  });

  it('returns true for a point on the bottom boundary', () => {
    expect(isInsideRect({ x: 200, y: 200 }, rect)).toBe(true);
  });

  it('returns true for a corner point', () => {
    expect(isInsideRect({ x: 100, y: 100 }, rect)).toBe(true);
    expect(isInsideRect({ x: 300, y: 200 }, rect)).toBe(true);
  });

  it('returns false for a point outside left', () => {
    expect(isInsideRect({ x: 99, y: 150 }, rect)).toBe(false);
  });

  it('returns false for a point outside right', () => {
    expect(isInsideRect({ x: 301, y: 150 }, rect)).toBe(false);
  });

  it('returns false for a point outside top', () => {
    expect(isInsideRect({ x: 200, y: 99 }, rect)).toBe(false);
  });

  it('returns false for a point outside bottom', () => {
    expect(isInsideRect({ x: 200, y: 201 }, rect)).toBe(false);
  });
});

/* ── findBoundaryIntersection ─────────────────────────────────── */

describe('findBoundaryIntersection', () => {
  it('finds t where curve exits the target rect (searchFromEnd)', () => {
    // Curve starts outside a rect and ends inside it
    const p0: Point = { x: 0, y: 50 };
    const cp1: Point = { x: 100, y: 50 };
    const cp2: Point = { x: 200, y: 50 };
    const p3: Point = { x: 300, y: 50 };
    const targetRect: Rect = { x: 200, y: 0, width: 200, height: 100 };

    const t = findBoundaryIntersection(p0, cp1, cp2, p3, targetRect, true);
    expect(t).toBeDefined();
    if (t === undefined) return;
    // The point at t should be just outside the rect
    const pt = bezierPointAt(p0, cp1, cp2, p3, t);
    expect(pt.x).toBeLessThan(targetRect.x + 1);
  });

  it('finds t where curve exits the source rect (searchFromStart)', () => {
    // Curve starts inside a rect and exits it
    const p0: Point = { x: 50, y: 50 };
    const cp1: Point = { x: 100, y: 50 };
    const cp2: Point = { x: 200, y: 50 };
    const p3: Point = { x: 400, y: 50 };
    const sourceRect: Rect = { x: 0, y: 0, width: 100, height: 100 };

    const t = findBoundaryIntersection(p0, cp1, cp2, p3, sourceRect, false);
    expect(t).toBeDefined();
    if (t === undefined) return;
    // The point at t should be just outside the rect
    const pt = bezierPointAt(p0, cp1, cp2, p3, t);
    expect(pt.x).toBeGreaterThan(sourceRect.x + sourceRect.width - 1);
  });

  it('returns undefined when curve stays inside the rect', () => {
    // Entire curve inside the rect
    const p0: Point = { x: 50, y: 50 };
    const cp1: Point = { x: 60, y: 50 };
    const cp2: Point = { x: 70, y: 50 };
    const p3: Point = { x: 80, y: 50 };
    const rect: Rect = { x: 0, y: 0, width: 200, height: 200 };

    const tEnd = findBoundaryIntersection(p0, cp1, cp2, p3, rect, true);
    expect(tEnd).toBeUndefined();

    const tStart = findBoundaryIntersection(p0, cp1, cp2, p3, rect, false);
    expect(tStart).toBeUndefined();
  });

  it('returns a t in the valid search range', () => {
    const p0: Point = { x: 0, y: 150 };
    const cp1: Point = { x: 100, y: 150 };
    const cp2: Point = { x: 200, y: 150 };
    const p3: Point = { x: 300, y: 150 };
    const targetRect: Rect = { x: 200, y: 100, width: 200, height: 100 };

    const t = findBoundaryIntersection(p0, cp1, cp2, p3, targetRect, true);
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(t).toBeGreaterThanOrEqual(0.5);
    expect(t).toBeLessThanOrEqual(0.95);
  });

  it('works with a realistic curved connection', () => {
    // Simulate a curve from one node to another
    const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
    const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };
    const fromCenter: Point = { x: 190, y: 140 };
    const toCenter: Point = { x: 590, y: 340 };

    // Simple control points
    const p0 = fromCenter;
    const p3 = toCenter;
    const cp1: Point = { x: 300, y: 100 };
    const cp2: Point = { x: 400, y: 380 };

    const t = findBoundaryIntersection(p0, cp1, cp2, p3, toBounds, true);
    expect(t).toBeDefined();
    if (t === undefined) return;

    // The found t should place the point near or at the boundary
    const pt = bezierPointAt(p0, cp1, cp2, p3, t);
    const isNearBoundary =
      !isInsideRect(pt, toBounds) ||
      Math.abs(pt.x - toBounds.x) < 2 ||
      Math.abs(pt.x - (toBounds.x + toBounds.width)) < 2 ||
      Math.abs(pt.y - toBounds.y) < 2 ||
      Math.abs(pt.y - (toBounds.y + toBounds.height)) < 2;
    expect(isNearBoundary).toBe(true);
  });
});

/* ── Boundary placement geometry ──────────────────────────────── */

describe('arrowPlacement boundary (curve)', () => {
  const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
  const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };
  const diagramCenter: Point = { x: 400, y: 300 };

  it('finds boundary intersection for end arrow on curve', () => {
    const [p0, cp1, cp2, p3] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);
    const tEnd = findBoundaryIntersection(p0, cp1, cp2, p3, toBounds, true);
    expect(tEnd).toBeDefined();
    if (tEnd === undefined) return;

    const pt = bezierPointAt(p0, cp1, cp2, p3, tEnd);
    // The point should be outside or at the boundary of toBounds
    expect(isInsideRect(pt, toBounds)).toBe(false);

    // Tangent at that point should be a valid direction
    const tangent = bezierTangentAt(p0, cp1, cp2, p3, tEnd);
    const angle = Math.atan2(tangent.y, tangent.x);
    expect(Number.isFinite(angle)).toBe(true);
  });

  it('finds boundary intersection for start arrow on curve', () => {
    const [p0, cp1, cp2, p3] = curveRoute(fromBounds, toBounds, diagramCenter, 0.35);
    const tStart = findBoundaryIntersection(p0, cp1, cp2, p3, fromBounds, false);
    expect(tStart).toBeDefined();
    if (tStart === undefined) return;

    const pt = bezierPointAt(p0, cp1, cp2, p3, tStart);
    expect(isInsideRect(pt, fromBounds)).toBe(false);

    const tangent = bezierTangentAt(p0, cp1, cp2, p3, tStart);
    const angle = Math.atan2(tangent.y, tangent.x) + Math.PI;
    expect(Number.isFinite(angle)).toBe(true);
  });
});

describe('arrowPlacement boundary (arc)', () => {
  const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
  const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };
  const diagramCenter: Point = { x: 400, y: 300 };

  it('finds boundary intersection for end arrow on arc second segment', () => {
    const [, second] = arcRoute(fromBounds, toBounds, diagramCenter, 0.35);
    const [pMid, cp3, cp4, p3] = second;
    const tEnd = findBoundaryIntersection(pMid, cp3, cp4, p3, toBounds, true);
    expect(tEnd).toBeDefined();
    if (tEnd === undefined) return;

    const pt = bezierPointAt(pMid, cp3, cp4, p3, tEnd);
    expect(isInsideRect(pt, toBounds)).toBe(false);

    const tangent = bezierTangentAt(pMid, cp3, cp4, p3, tEnd);
    const angle = Math.atan2(tangent.y, tangent.x);
    expect(Number.isFinite(angle)).toBe(true);
  });

  it('finds boundary intersection for start arrow on arc first segment', () => {
    const [first] = arcRoute(fromBounds, toBounds, diagramCenter, 0.35);
    const [p0, cp1, cp2, pMid] = first;
    const tStart = findBoundaryIntersection(p0, cp1, cp2, pMid, fromBounds, false);
    expect(tStart).toBeDefined();
    if (tStart === undefined) return;

    const pt = bezierPointAt(p0, cp1, cp2, pMid, tStart);
    expect(isInsideRect(pt, fromBounds)).toBe(false);

    const tangent = bezierTangentAt(p0, cp1, cp2, pMid, tStart);
    const angle = Math.atan2(tangent.y, tangent.x) + Math.PI;
    expect(Number.isFinite(angle)).toBe(true);
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

/* ── Infer ellipse params ─────────────────────────────────────── */

describe('inferEllipseParams', () => {
  it('uses explicit center and radii when provided', () => {
    const nodes: Rect[] = [
      { x: 100, y: 100, width: 100, height: 50 },
      { x: 400, y: 300, width: 100, height: 50 },
    ];
    const result = inferEllipseParams(nodes, { x: 300, y: 200 }, 500, 250);
    expect(result.cx).toBe(300);
    expect(result.cy).toBe(200);
    expect(result.rx).toBe(500);
    expect(result.ry).toBe(250);
  });

  it('infers center from node centroids', () => {
    const nodes: Rect[] = [
      { x: 0, y: 0, width: 100, height: 100 }, // center (50, 50)
      { x: 200, y: 0, width: 100, height: 100 }, // center (250, 50)
      { x: 100, y: 200, width: 100, height: 100 }, // center (150, 250)
    ];
    const result = inferEllipseParams(nodes);
    expect(result.cx).toBeCloseTo(150);
    expect(result.cy).toBeCloseTo(350 / 3);
  });

  it('infers radii from max distance to centroid', () => {
    // 6 nodes on the example ellipse (cx=600, cy=355, rx=395, ry=195)
    const nodes: Rect[] = [
      { x: 522, y: 129, width: 155, height: 62 }, // triage center: (599.5, 160)
      { x: 865, y: 226, width: 155, height: 62 }, // design center: (942.5, 257)
      { x: 865, y: 422, width: 155, height: 62 }, // executor center: (942.5, 453)
      { x: 522, y: 519, width: 155, height: 62 }, // reviewer center: (599.5, 550)
      { x: 180, y: 422, width: 155, height: 62 }, // quality center: (257.5, 453)
      { x: 180, y: 226, width: 155, height: 62 }, // opportunity center: (257.5, 257)
    ];
    const result = inferEllipseParams(nodes);
    // Centroid should be close to (600, 355)
    expect(result.cx).toBeCloseTo(600, 0);
    expect(result.cy).toBeCloseTo(355, 0);
    // rx and ry should be close to the max distances
    expect(result.rx).toBeGreaterThan(300);
    expect(result.ry).toBeGreaterThan(150);
  });

  it('uses explicit radii with inferred center', () => {
    const nodes: Rect[] = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 200, y: 200, width: 100, height: 100 },
    ];
    const result = inferEllipseParams(nodes, undefined, 400, 300);
    // Center should be inferred from nodes
    expect(result.cx).toBeCloseTo(150);
    expect(result.cy).toBeCloseTo(150);
    // Radii should be the explicit values
    expect(result.rx).toBe(400);
    expect(result.ry).toBe(300);
  });

  it('returns defaults for empty node list', () => {
    const result = inferEllipseParams([]);
    expect(result.rx).toBe(1);
    expect(result.ry).toBe(1);
  });

  it('returns explicit center for empty node list with center', () => {
    const result = inferEllipseParams([], { x: 500, y: 300 });
    expect(result.cx).toBe(500);
    expect(result.cy).toBe(300);
  });
});

/* ── Ellipse route ────────────────────────────────────────────── */

describe('ellipseRoute', () => {
  // 6-node ellipse layout from the spec example
  const ellipse: EllipseParams = { cx: 600, cy: 355, rx: 395, ry: 195 };
  const triageBounds: Rect = { x: 522, y: 129, width: 155, height: 62 };
  const designBounds: Rect = { x: 865, y: 226, width: 155, height: 62 };
  const executorBounds: Rect = { x: 865, y: 422, width: 155, height: 62 };
  const reviewerBounds: Rect = { x: 522, y: 519, width: 155, height: 62 };
  const qualityBounds: Rect = { x: 180, y: 422, width: 155, height: 62 };
  const opportunityBounds: Rect = { x: 180, y: 226, width: 155, height: 62 };

  it('returns four points [p0, cp1, cp2, p3]', () => {
    const result = ellipseRoute(triageBounds, designBounds, ellipse);
    expect(result).toHaveLength(4);
    for (const pt of result) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('start point lies on fromBounds edge', () => {
    const [p0] = ellipseRoute(triageBounds, designBounds, ellipse);
    const onHoriz =
      Math.abs(p0.x - triageBounds.x) < 0.01 ||
      Math.abs(p0.x - (triageBounds.x + triageBounds.width)) < 0.01;
    const onVert =
      Math.abs(p0.y - triageBounds.y) < 0.01 ||
      Math.abs(p0.y - (triageBounds.y + triageBounds.height)) < 0.01;
    expect(onHoriz || onVert).toBe(true);
  });

  it('end point lies on toBounds edge', () => {
    const [, , , p3] = ellipseRoute(triageBounds, designBounds, ellipse);
    const onHoriz =
      Math.abs(p3.x - designBounds.x) < 0.01 ||
      Math.abs(p3.x - (designBounds.x + designBounds.width)) < 0.01;
    const onVert =
      Math.abs(p3.y - designBounds.y) < 0.01 ||
      Math.abs(p3.y - (designBounds.y + designBounds.height)) < 0.01;
    expect(onHoriz || onVert).toBe(true);
  });

  it('produces finite non-degenerate control points', () => {
    const [p0, cp1, cp2, p3] = ellipseRoute(triageBounds, designBounds, ellipse);
    // Control points should not be identical to endpoints
    const cp1Dist = Math.hypot(cp1.x - p0.x, cp1.y - p0.y);
    const cp2Dist = Math.hypot(cp2.x - p3.x, cp2.y - p3.y);
    expect(cp1Dist).toBeGreaterThan(1);
    expect(cp2Dist).toBeGreaterThan(1);
  });

  it('curves bow outward from ellipse center', () => {
    const [p0, cp1, cp2, p3] = ellipseRoute(triageBounds, designBounds, ellipse);
    const midpoint = bezierPointAt(p0, cp1, cp2, p3, 0.5);
    // The midpoint of the curve should be further from the ellipse center
    // than the straight-line midpoint
    const straightMid: Point = { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };
    const curveDist = Math.hypot(midpoint.x - ellipse.cx, midpoint.y - ellipse.cy);
    const straightDist = Math.hypot(straightMid.x - ellipse.cx, straightMid.y - ellipse.cy);
    expect(curveDist).toBeGreaterThan(straightDist);
  });

  it('all six connections form a smooth cycle', () => {
    // Test that all connections between the 6 nodes produce valid bezier curves
    const allBounds = [
      triageBounds,
      designBounds,
      executorBounds,
      reviewerBounds,
      qualityBounds,
      opportunityBounds,
    ];

    for (let i = 0; i < allBounds.length; i++) {
      const from = allBounds[i];
      const to = allBounds[(i + 1) % allBounds.length];
      const [p0, cp1, cp2, p3] = ellipseRoute(from, to, ellipse);

      // All points should be finite
      for (const pt of [p0, cp1, cp2, p3]) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }

      // Curve should have non-degenerate control points
      const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      expect(dist).toBeGreaterThan(10);
    }
  });

  it('handles coincident node centers gracefully', () => {
    const a: Rect = { x: 100, y: 100, width: 50, height: 50 };
    const b: Rect = { x: 100, y: 100, width: 50, height: 50 };
    const result = ellipseRoute(a, b, ellipse);
    for (const pt of result) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('respects anchor hints', () => {
    const [p0WithAnchor] = ellipseRoute(triageBounds, designBounds, ellipse, 'bottom');
    expect(p0WithAnchor.x).toBeCloseTo(triageBounds.x + triageBounds.width / 2);
    expect(p0WithAnchor.y).toBeCloseTo(triageBounds.y + triageBounds.height);
  });

  it('uses generalized kappa based on angular span', () => {
    // For ~60° arcs (6 nodes), kappa should be ~0.357
    const [p0, cp1] = ellipseRoute(triageBounds, designBounds, ellipse);
    const cp1Dist = Math.hypot(cp1.x - p0.x, cp1.y - p0.y);
    // Control point distance should be non-trivial (kappa > 0)
    expect(cp1Dist).toBeGreaterThan(5);
  });
});

/* ── Straight route ───────────────────────────────────────────── */

describe('straightRoute', () => {
  const fromBounds: Rect = { x: 100, y: 100, width: 180, height: 80 };
  const toBounds: Rect = { x: 500, y: 300, width: 180, height: 80 };

  it('returns two points [p0, p3]', () => {
    const result = straightRoute(fromBounds, toBounds);
    expect(result).toHaveLength(2);
    for (const pt of result) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('start point lies on fromBounds edge', () => {
    const [p0] = straightRoute(fromBounds, toBounds);
    const onHoriz =
      Math.abs(p0.x - fromBounds.x) < 0.01 ||
      Math.abs(p0.x - (fromBounds.x + fromBounds.width)) < 0.01;
    const onVert =
      Math.abs(p0.y - fromBounds.y) < 0.01 ||
      Math.abs(p0.y - (fromBounds.y + fromBounds.height)) < 0.01;
    expect(onHoriz || onVert).toBe(true);
  });

  it('end point lies on toBounds edge', () => {
    const [, p3] = straightRoute(fromBounds, toBounds);
    const onHoriz =
      Math.abs(p3.x - toBounds.x) < 0.01 || Math.abs(p3.x - (toBounds.x + toBounds.width)) < 0.01;
    const onVert =
      Math.abs(p3.y - toBounds.y) < 0.01 || Math.abs(p3.y - (toBounds.y + toBounds.height)) < 0.01;
    expect(onHoriz || onVert).toBe(true);
  });

  it('respects fromAnchor hint', () => {
    const [p0] = straightRoute(fromBounds, toBounds, 'top');
    expect(p0.x).toBeCloseTo(fromBounds.x + fromBounds.width / 2);
    expect(p0.y).toBeCloseTo(fromBounds.y);
  });

  it('respects toAnchor hint', () => {
    const [, p3] = straightRoute(fromBounds, toBounds, undefined, 'left');
    expect(p3.x).toBeCloseTo(toBounds.x);
    expect(p3.y).toBeCloseTo(toBounds.y + toBounds.height / 2);
  });
});
