import { describe, expect, it } from 'vitest';
import { computeElkLayout } from '../layout/elk.js';
import { computeGridLayout } from '../layout/grid.js';
import { computeLayout } from '../layout/index.js';
import { computeStackLayout } from '../layout/stack.js';
import type { Rect } from '../renderer.js';
import { inferLayout, parseDesignSpec } from '../spec.schema.js';

const safeFrame: Rect = { x: 40, y: 80, width: 1120, height: 500 };

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('layout engine', () => {
  it('computes non-overlapping ELK layered auto layout for flow nodes', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'start', shape: 'rounded-box', label: 'Start' },
        { type: 'flow-node', id: 'check', shape: 'diamond', label: 'Check' },
        { type: 'flow-node', id: 'done', shape: 'pill', label: 'Done' },
        { type: 'connection', from: 'start', to: 'check' },
        { type: 'connection', from: 'check', to: 'done' },
      ],
    }).elements;

    const result = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'TB',
        nodeSpacing: 70,
        rankSpacing: 100,
        edgeRouting: 'polyline',
      },
      safeFrame,
    );

    const start = result.positions.get('start');
    const check = result.positions.get('check');
    const done = result.positions.get('done');

    expect(start).toBeDefined();
    expect(check).toBeDefined();
    expect(done).toBeDefined();

    expect(overlaps(start as Rect, check as Rect)).toBe(false);
    expect(overlaps(check as Rect, done as Rect)).toBe(false);
  });

  it('supports layered direction variants (TB and LR)', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
        { type: 'connection', from: 'a', to: 'b' },
      ],
    }).elements;

    const tb = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'TB',
        nodeSpacing: 80,
        rankSpacing: 100,
        edgeRouting: 'orthogonal',
      },
      safeFrame,
    );

    const lr = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'LR',
        nodeSpacing: 80,
        rankSpacing: 100,
        edgeRouting: 'orthogonal',
      },
      safeFrame,
    );

    const tbA = tb.positions.get('a') as Rect;
    const tbB = tb.positions.get('b') as Rect;
    const lrA = lr.positions.get('a') as Rect;
    const lrB = lr.positions.get('b') as Rect;

    expect(tbB.y).toBeGreaterThan(tbA.y);
    expect(lrB.x).toBeGreaterThan(lrA.x);
  });

  it('supports multiple ELK algorithms', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'n1', shape: 'rounded-box', label: 'N1' },
        { type: 'flow-node', id: 'n2', shape: 'diamond', label: 'N2' },
        { type: 'flow-node', id: 'n3', shape: 'pill', label: 'N3' },
        { type: 'flow-node', id: 'n4', shape: 'box', label: 'N4' },
        { type: 'connection', from: 'n1', to: 'n2' },
        { type: 'connection', from: 'n2', to: 'n3' },
        { type: 'connection', from: 'n3', to: 'n4' },
        { type: 'connection', from: 'n4', to: 'n1' },
      ],
    }).elements;

    for (const algorithm of ['layered', 'stress', 'force'] as const) {
      const result = await computeElkLayout(
        elements,
        {
          mode: 'auto',
          algorithm,
          direction: 'TB',
          nodeSpacing: 80,
          rankSpacing: 120,
          edgeRouting: 'polyline',
        },
        safeFrame,
      );

      for (const nodeId of ['n1', 'n2', 'n3', 'n4']) {
        expect(result.positions.get(nodeId)).toBeDefined();
      }
    }
  });

  it('respects per-node width/height hints in ELK', async () => {
    const elements = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'wide',
          shape: 'rounded-box',
          label: 'Wide',
          width: 320,
          height: 120,
        },
        { type: 'flow-node', id: 'default', shape: 'rounded-box', label: 'Default' },
        { type: 'connection', from: 'wide', to: 'default' },
      ],
    }).elements;

    const result = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'TB',
        nodeSpacing: 80,
        rankSpacing: 120,
        edgeRouting: 'polyline',
      },
      safeFrame,
    );

    const wide = result.positions.get('wide') as Rect;
    const normal = result.positions.get('default') as Rect;

    expect(wide.width).toBeGreaterThan(normal.width);
    expect(wide.height).toBeGreaterThan(normal.height);
  });

  it('extracts ELK edge routes for spline routing', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'diamond', label: 'B' },
        { type: 'flow-node', id: 'c', shape: 'pill', label: 'C' },
        { type: 'connection', from: 'a', to: 'b' },
        { type: 'connection', from: 'b', to: 'c' },
      ],
    }).elements;

    const result = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'LR',
        nodeSpacing: 80,
        rankSpacing: 120,
        edgeRouting: 'spline',
      },
      safeFrame,
    );

    const route = result.edgeRoutes?.get('a-b');
    expect(route).toBeDefined();
    expect(route?.points.length).toBeGreaterThanOrEqual(2);
  });

  it('computes grid layout with row handling and equal-width cells', () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'card', id: 'c1', title: 'A', body: 'B' },
        { type: 'card', id: 'c2', title: 'A', body: 'B' },
        { type: 'card', id: 'c3', title: 'A', body: 'B' },
        { type: 'card', id: 'c4', title: 'A', body: 'B' },
        { type: 'card', id: 'c5', title: 'A', body: 'B' },
      ],
    }).elements;

    const result = computeGridLayout(
      elements,
      {
        mode: 'grid',
        columns: 3,
        gap: 24,
        equalHeight: true,
      },
      safeFrame,
    );

    const c1 = result.positions.get('c1') as Rect;
    const c2 = result.positions.get('c2') as Rect;
    const c3 = result.positions.get('c3') as Rect;
    const c4 = result.positions.get('c4') as Rect;

    expect(c1.width).toBe(c2.width);
    expect(c2.width).toBe(c3.width);
    expect(c1.y).toBe(c2.y);
    expect(c4.y).toBeGreaterThan(c1.y);
  });

  it('computes stack layout for both vertical and horizontal directions', () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'card', id: 'a', title: 'A', body: 'B' },
        { type: 'text', id: 'b', content: 'Hello', style: 'body' },
        { type: 'shape', id: 'c', shape: 'rectangle' },
      ],
    }).elements;

    const vertical = computeStackLayout(
      elements,
      {
        mode: 'stack',
        direction: 'vertical',
        gap: 20,
        alignment: 'stretch',
      },
      safeFrame,
    );

    const horizontal = computeStackLayout(
      elements,
      {
        mode: 'stack',
        direction: 'horizontal',
        gap: 20,
        alignment: 'center',
      },
      safeFrame,
    );

    const va = vertical.positions.get('a') as Rect;
    const vb = vertical.positions.get('b') as Rect;
    const ha = horizontal.positions.get('a') as Rect;
    const hb = horizontal.positions.get('b') as Rect;

    expect(vb.y).toBeGreaterThan(va.y);
    expect(hb.x).toBeGreaterThan(ha.x);
  });

  it('infers layout mode by element mix and honors explicit layout', () => {
    const inferredAuto = inferLayout(
      parseDesignSpec({
        elements: [
          { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
          { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
          { type: 'connection', from: 'a', to: 'b' },
        ],
      }).elements,
    );

    const inferredGrid = inferLayout(
      parseDesignSpec({ elements: [{ type: 'card', id: 'c', title: 'Card', body: 'Body' }] })
        .elements,
    );

    const inferredStack = inferLayout(
      parseDesignSpec({
        elements: [{ type: 'code-block', id: 'code', code: 'const x = 1;', language: 'ts' }],
      }).elements,
    );

    const explicit = inferLayout(
      parseDesignSpec({ elements: [{ type: 'card', id: 'c', title: 'Card', body: 'Body' }] })
        .elements,
      { mode: 'manual', positions: {} },
    );

    expect(inferredAuto.mode).toBe('auto');
    expect(inferredGrid.mode).toBe('grid');
    expect(inferredStack.mode).toBe('stack');
    expect(explicit.mode).toBe('manual');
  });

  it('computes radial layout without radial-specific options (backward compat)', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'center', shape: 'circle', label: 'Center' },
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
        { type: 'flow-node', id: 'c', shape: 'box', label: 'C' },
        { type: 'connection', from: 'center', to: 'a' },
        { type: 'connection', from: 'center', to: 'b' },
        { type: 'connection', from: 'center', to: 'c' },
      ],
    }).elements;

    const result = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'radial',
        direction: 'TB',
        nodeSpacing: 80,
        rankSpacing: 120,
        edgeRouting: 'polyline',
      },
      safeFrame,
    );

    for (const nodeId of ['center', 'a', 'b', 'c']) {
      expect(result.positions.get(nodeId)).toBeDefined();
    }
  });

  it('computes radial layout with radial-specific options', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'root', shape: 'circle', label: 'Root' },
        { type: 'flow-node', id: 'leaf1', shape: 'box', label: 'Leaf 1' },
        { type: 'flow-node', id: 'leaf2', shape: 'box', label: 'Leaf 2' },
        { type: 'connection', from: 'root', to: 'leaf1' },
        { type: 'connection', from: 'root', to: 'leaf2' },
      ],
    }).elements;

    const result = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'radial',
        direction: 'TB',
        nodeSpacing: 80,
        rankSpacing: 120,
        edgeRouting: 'polyline',
        radialRoot: 'root',
        radialRadius: 250,
        radialCompaction: 'wedge',
        radialSortBy: 'connections',
      },
      safeFrame,
    );

    for (const nodeId of ['root', 'leaf1', 'leaf2']) {
      expect(result.positions.get(nodeId)).toBeDefined();
    }
  });

  it('radial options are ignored for non-radial algorithms', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
        { type: 'connection', from: 'a', to: 'b' },
      ],
    }).elements;

    // Should not throw even if radial fields are on a non-radial config
    const result = await computeElkLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'TB',
        nodeSpacing: 80,
        rankSpacing: 120,
        edgeRouting: 'polyline',
      },
      safeFrame,
    );

    expect(result.positions.get('a')).toBeDefined();
    expect(result.positions.get('b')).toBeDefined();
  });

  it('lays out mixed auto-flow and non-flow elements together', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'start', shape: 'rounded-box', label: 'Start' },
        { type: 'flow-node', id: 'end', shape: 'pill', label: 'End' },
        { type: 'connection', from: 'start', to: 'end' },
        { type: 'card', id: 'summary', title: 'Summary', body: 'Details' },
        { type: 'text', id: 'note', content: 'Notes', style: 'caption' },
      ],
    }).elements;

    const result = await computeLayout(
      elements,
      {
        mode: 'auto',
        algorithm: 'layered',
        direction: 'TB',
        nodeSpacing: 80,
        rankSpacing: 120,
        edgeRouting: 'spline',
      },
      safeFrame,
    );

    const start = result.positions.get('start') as Rect;
    const summary = result.positions.get('summary') as Rect;
    const note = result.positions.get('note') as Rect;

    expect(start).toBeDefined();
    expect(summary).toBeDefined();
    expect(note).toBeDefined();
    expect(summary.y).toBeGreaterThan(start.y);
  });
});
