import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderFlowNode } from '../renderers/flow-node.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

const theme = resolveTheme('dark');

function makeCanvas() {
  const canvas = createCanvas(1200, 675);
  return canvas.getContext('2d');
}

const bounds = { x: 100, y: 100, width: 200, height: 100 };

describe('flow-node shadow', () => {
  // --- Schema validation ---

  it('accepts shadow with all properties', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'A',
          shadow: {
            color: '#FF0000',
            blur: 16,
            offsetX: 4,
            offsetY: 4,
            opacity: 0.5,
          },
        },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type === 'flow-node' && n1.shadow).toEqual({
      color: '#FF0000',
      blur: 16,
      offsetX: 4,
      offsetY: 4,
      opacity: 0.5,
    });
  });

  it('applies defaults when shadow is provided with minimal config', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'A',
          shadow: {},
        },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type === 'flow-node' && n1.shadow).toEqual({
      blur: 8,
      offsetX: 0,
      offsetY: 0,
      opacity: 0.3,
    });
  });

  it('omits shadow when not specified (backward compat)', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type === 'flow-node' && n1.shadow).toBeUndefined();
  });

  it('rejects blur outside 0-64 range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            shadow: { blur: 100 },
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            shadow: { blur: -1 },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects offsetX outside -32..32 range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            shadow: { offsetX: 50 },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects offsetY outside -32..32 range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            shadow: { offsetY: -40 },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects opacity outside 0-1 range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            shadow: { opacity: 1.5 },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects unknown properties in shadow (strict mode)', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            shadow: { blur: 8, unknown: true },
          },
        ],
      }),
    ).toThrow();
  });

  // --- Rendering tests ---

  it('renders with shadow without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Glow',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
        shadow: { blur: 12, offsetX: 0, offsetY: 0, opacity: 0.5 },
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('renders without shadow when omitted (backward compat rendering)', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'No Shadow',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('uses borderColor as default shadow color', () => {
    const ctx = makeCanvas();
    // Should not throw — borderColor is used as fallback
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Border Shadow',
        borderColor: '#00FF00',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
        shadow: { blur: 8, offsetX: 0, offsetY: 0, opacity: 0.4 },
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('uses explicit shadow color over borderColor', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Custom Shadow',
        borderColor: '#00FF00',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
        shadow: { color: '#FF0000', blur: 8, offsetX: 0, offsetY: 0, opacity: 0.4 },
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with shadow and fillOpacity < 1 without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Semi-transparent + Shadow',
        fillOpacity: 0.5,
        opacity: 1,
        badgePosition: 'inside-top',
        shadow: { blur: 10, offsetX: 2, offsetY: 2, opacity: 0.3 },
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with shadow and offset values', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Drop Shadow',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
        shadow: { blur: 4, offsetX: 8, offsetY: 8, opacity: 0.6 },
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  // --- All 7 shapes ---

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
    it(`renders ${shape} with shadow without throwing`, () => {
      const ctx = makeCanvas();
      const elements = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: `node-${shape}`,
          shape,
          label: shape,
          opacity: 1,
          fillOpacity: 1,
          badgePosition: 'inside-top',
          shadow: { blur: 12, offsetX: 0, offsetY: 0, opacity: 0.4 },
        },
        bounds,
        theme,
      );
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].kind).toBe('flow-node');
    });
  }
});
