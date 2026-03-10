import { describe, expect, it } from 'vitest';
import { computeEllipseLayout } from '../layout/ellipse.js';
import { computeLayout } from '../layout/index.js';
import type { Rect } from '../renderer.js';
import { renderDesign } from '../renderer.js';
import { parseDesignSpec } from '../spec.schema.js';

const safeFrame: Rect = { x: 40, y: 80, width: 1120, height: 500 };

function rectCenter(rect: Rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

describe('ellipse layout', () => {
  it('parses ellipse layout config and defaults startAngle to -90', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'a', shape: 'box', label: 'A' }],
      layout: { mode: 'ellipse', rx: 240, ry: 160 },
    });

    expect(spec.layout.mode).toBe('ellipse');
    if (spec.layout.mode === 'ellipse') {
      expect(spec.layout.startAngle).toBe(-90);
      expect(spec.layout.cx).toBeUndefined();
      expect(spec.layout.cy).toBeUndefined();
      expect(spec.layout.rx).toBe(240);
      expect(spec.layout.ry).toBe(160);
    }
  });

  it('positions 6 nodes evenly on the configured ellipse with top-first default', () => {
    const elements = parseDesignSpec({
      elements: Array.from({ length: 6 }, (_, index) => ({
        type: 'flow-node' as const,
        id: `n${index + 1}`,
        shape: 'box' as const,
        label: `Node ${index + 1}`,
      })),
    }).elements;

    const result = computeEllipseLayout(
      elements,
      { mode: 'ellipse', cx: 600, cy: 320, rx: 240, ry: 160, startAngle: -90 },
      safeFrame,
    );

    const expectedCenters = [
      { x: 600, y: 160 },
      { x: 600 + 240 * Math.cos(-Math.PI / 6), y: 320 + 160 * Math.sin(-Math.PI / 6) },
      { x: 600 + 240 * Math.cos(Math.PI / 6), y: 320 + 160 * Math.sin(Math.PI / 6) },
      { x: 600, y: 480 },
      { x: 600 + 240 * Math.cos((5 * Math.PI) / 6), y: 320 + 160 * Math.sin((5 * Math.PI) / 6) },
      { x: 600 + 240 * Math.cos((7 * Math.PI) / 6), y: 320 + 160 * Math.sin((7 * Math.PI) / 6) },
    ];

    for (const [index, expected] of expectedCenters.entries()) {
      const rect = result.positions.get(`n${index + 1}`);
      expect(rect).toBeDefined();
      const center = rectCenter(rect as Rect);
      expect(center.x).toBeCloseTo(expected.x, 0);
      expect(center.y).toBeCloseTo(expected.y, 0);
    }
  });

  it('works with arbitrary node counts', () => {
    const elements = parseDesignSpec({
      elements: Array.from({ length: 5 }, (_, index) => ({
        type: 'flow-node' as const,
        id: `node-${index + 1}`,
        shape: 'box' as const,
        label: `Node ${index + 1}`,
      })),
    }).elements;

    const cx = 420;
    const cy = 260;
    const rx = 180;
    const ry = 120;
    const result = computeEllipseLayout(
      elements,
      { mode: 'ellipse', cx, cy, rx, ry, startAngle: -45 },
      safeFrame,
    );

    expect(result.positions.size).toBe(5);

    for (const element of elements) {
      if (element.type === 'connection') {
        continue;
      }
      const rect = result.positions.get(element.id) as Rect;
      const center = rectCenter(rect);
      const normalized = ((center.x - cx) / rx) ** 2 + ((center.y - cy) / ry) ** 2;
      expect(normalized).toBeCloseTo(1, 1);
    }
  });

  it('dispatches computeLayout to ellipse mode', async () => {
    const elements = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
        { type: 'flow-node', id: 'c', shape: 'box', label: 'C' },
      ],
    }).elements;

    const config = { mode: 'ellipse' as const, cx: 500, cy: 300, rx: 180, ry: 120, startAngle: 0 };
    const direct = computeEllipseLayout(elements, config, safeFrame);
    const dispatched = await computeLayout(elements, config, safeFrame);

    expect(dispatched.positions).toEqual(direct.positions);
  });

  it('keeps connection rendering compatible with ellipse layouts', async () => {
    const spec = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'rounded-box', label: 'Start' },
        { type: 'flow-node', id: 'b', shape: 'diamond', label: 'Check' },
        { type: 'flow-node', id: 'c', shape: 'pill', label: 'Done' },
        { type: 'connection', from: 'a', to: 'b', routing: 'curve', curveMode: 'ellipse' },
        { type: 'connection', from: 'b', to: 'c', routing: 'curve', curveMode: 'ellipse' },
      ],
      layout: {
        mode: 'ellipse',
        cx: 600,
        cy: 320,
        rx: 220,
        ry: 150,
        startAngle: -90,
        diagramCenter: { x: 600, y: 320 },
        ellipseRx: 220,
        ellipseRy: 150,
      },
    });

    const layout = await computeLayout(spec.elements, spec.layout, safeFrame);
    expect(layout.positions.get('a')).toBeDefined();
    expect(layout.positions.get('b')).toBeDefined();
    expect(layout.positions.get('c')).toBeDefined();
    expect(layout.positions.get('a-b')).toBeUndefined();

    const rendered = await renderDesign(spec, { generatorVersion: 'test-ellipse-layout' });
    expect(rendered.metadata.layout.elements.some((el) => el.id === 'flow-node-a')).toBe(true);
    expect(rendered.metadata.layout.elements.some((el) => el.id === 'flow-node-b')).toBe(true);
    expect(rendered.metadata.layout.elements.some((el) => el.id === 'flow-node-c')).toBe(true);
    expect(rendered.metadata.layout.elements.some((el) => el.kind === 'connection')).toBe(true);
  });
});
