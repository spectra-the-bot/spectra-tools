import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderFlowNode } from '../renderers/flow-node.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';
import { blendColorWithOpacity } from '../utils/color.js';

const theme = resolveTheme('dark');

function makeCanvas() {
  const canvas = createCanvas(1200, 675);
  return canvas.getContext('2d');
}

const bounds = { x: 100, y: 100, width: 200, height: 100 };

describe('flow-node fillOpacity', () => {
  it('accepts fillOpacity in the schema (0-1, default 1)', () => {
    const spec = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'n1', shape: 'box', label: 'A', fillOpacity: 0.5 },
        { type: 'flow-node', id: 'n2', shape: 'box', label: 'B' },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    const n2 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n2');

    expect(n1?.type === 'flow-node' && n1.fillOpacity).toBe(0.5);
    // Default should be 1
    expect(n2?.type === 'flow-node' && n2.fillOpacity).toBe(1);
  });

  it('rejects fillOpacity outside 0-1 range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A', fillOpacity: 1.5 }],
      }),
    ).toThrow();

    expect(() =>
      parseDesignSpec({
        elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A', fillOpacity: -0.1 }],
      }),
    ).toThrow();
  });

  it('renders with fillOpacity 0 (fully transparent fill) without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Transparent',
        fillOpacity: 0,
        opacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with fillOpacity 0.5 (half-opacity fill) without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Half',
        fillOpacity: 0.5,
        opacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with fillOpacity 1.0 (fully opaque, same as default) without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Opaque',
        fillOpacity: 1,
        opacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders identically when fillOpacity is omitted (backward compat)', () => {
    const ctx = makeCanvas();
    const elementsDefault = renderFlowNode(
      ctx,
      { type: 'flow-node', id: 'n1', shape: 'rounded-box', label: 'Default', opacity: 1 },
      bounds,
      theme,
    );
    const elementsExplicit = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Default',
        fillOpacity: 1,
        opacity: 1,
      },
      bounds,
      theme,
    );

    // Both should produce the same metadata (same background colors, same bounds)
    expect(elementsDefault[0].backgroundColor).toBe(elementsExplicit[0].backgroundColor);
    expect(elementsDefault[1].backgroundColor).toBe(elementsExplicit[1].backgroundColor);
  });

  it('reports blended background color for QA when fillOpacity < 1', () => {
    const ctx = makeCanvas();
    const fillColor = '#202D55'; // theme.surfaceElevated (default for flow-node)
    const expected = blendColorWithOpacity(fillColor, theme.background, 0.5);

    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Semi',
        fillOpacity: 0.5,
        opacity: 1,
      },
      bounds,
      theme,
    );

    // Both the node and label elements should report the blended background
    expect(elements[0].backgroundColor).toBe(expected);
    expect(elements[1].backgroundColor).toBe(expected);
  });

  it('reports raw fill color for QA when fillOpacity is 1', () => {
    const ctx = makeCanvas();
    const fillColor = '#FF0000';

    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Opaque',
        color: fillColor,
        fillOpacity: 1,
        opacity: 1,
      },
      bounds,
      theme,
    );

    expect(elements[0].backgroundColor).toBe(fillColor);
  });

  const shapes = [
    'box',
    'rounded-box',
    'diamond',
    'circle',
    'pill',
    'cylinder',
    'parallelogram',
  ] as const;

  for (const shape of shapes) {
    it(`renders ${shape} with fillOpacity 0.5 without throwing`, () => {
      const ctx = makeCanvas();
      const elements = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: `node-${shape}`,
          shape,
          label: shape,
          fillOpacity: 0.5,
          opacity: 1,
        },
        bounds,
        theme,
      );
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].kind).toBe('flow-node');
    });
  }
});
