import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it, vi } from 'vitest';
import { renderFlowNode } from '../renderers/flow-node.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

const theme = resolveTheme('dark');

function makeCanvas() {
  const canvas = createCanvas(1200, 675);
  return canvas.getContext('2d');
}

const bounds = { x: 100, y: 100, width: 200, height: 100 };

describe('flow-node accent bar schema', () => {
  it('accepts accentColor', () => {
    const spec = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'n1', shape: 'rounded-box', label: 'A', accentColor: '#FF5500' },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type === 'flow-node' && n1.accentColor).toBe('#FF5500');
  });

  it('accepts accentBarWidth with accentColor', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'A',
          accentColor: '#00FF00',
          accentBarWidth: 5,
        },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentColor).toBe('#00FF00');
      expect(n1.accentBarWidth).toBe(5);
    }
  });

  it('defaults accentBarWidth to 3', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A', accentColor: '#FF0000' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentBarWidth).toBe(3);
    }
  });

  it('allows omitting accentColor (backward compatible)', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentColor).toBeUndefined();
    }
  });

  it('rejects invalid accentColor', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          { type: 'flow-node', id: 'n1', shape: 'box', label: 'A', accentColor: 'not-a-color' },
        ],
      }),
    ).toThrow();
  });

  it('rejects accentBarWidth above 16', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            accentColor: '#FF0000',
            accentBarWidth: 20,
          },
        ],
      }),
    ).toThrow();
  });
});

describe('flow-node accent bar rendering', () => {
  it('renders accent bar on rounded-box without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Node',
        accentColor: '#FF5500',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('renders accent bar on box shape without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Box Node',
        accentColor: '#0055FF',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('uses custom accentBarWidth', () => {
    const ctx = makeCanvas();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Wide Bar',
        accentColor: '#FF0000',
        accentBarWidth: 8,
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    // The accent bar fillRect should be called with width=8
    const accentCall = fillRectSpy.mock.calls.find(
      (call) => call[0] === bounds.x && call[1] === bounds.y && call[2] === 8,
    );
    expect(accentCall).toBeDefined();
    expect(accentCall?.[3]).toBe(bounds.height);
    fillRectSpy.mockRestore();
  });

  it('defaults accentBarWidth to 3', () => {
    const ctx = makeCanvas();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Default Bar',
        accentColor: '#00FF00',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    // The accent bar fillRect should be called with width=3
    const accentCall = fillRectSpy.mock.calls.find(
      (call) => call[0] === bounds.x && call[1] === bounds.y && call[2] === 3,
    );
    expect(accentCall).toBeDefined();
    expect(accentCall?.[3]).toBe(bounds.height);
    fillRectSpy.mockRestore();
  });

  it('does not render accent bar when accentColor is not set', () => {
    const ctx = makeCanvas();
    const clipSpy = vi.spyOn(ctx, 'clip');
    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'No Accent',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    // clip should NOT be called when there's no accent bar
    expect(clipSpy).not.toHaveBeenCalled();
    clipSpy.mockRestore();
  });

  it('uses clip path for corner rounding on rounded-box', () => {
    const ctx = makeCanvas();
    const clipSpy = vi.spyOn(ctx, 'clip');
    const roundRectSpy = vi.spyOn(ctx, 'roundRect');
    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Clipped',
        accentColor: '#FF5500',
        cornerRadius: 12,
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    // clip should be called for the accent bar
    expect(clipSpy).toHaveBeenCalled();
    // roundRect should be called with the node's corner radius for clipping
    const clipRoundRect = roundRectSpy.mock.calls.find(
      (call) =>
        call[0] === bounds.x &&
        call[1] === bounds.y &&
        call[2] === bounds.width &&
        call[3] === bounds.height &&
        call[4] === 12,
    );
    expect(clipRoundRect).toBeDefined();
    clipSpy.mockRestore();
    roundRectSpy.mockRestore();
  });

  it('uses 0 corner radius for clip path on box shape', () => {
    const ctx = makeCanvas();
    const roundRectSpy = vi.spyOn(ctx, 'roundRect');
    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Box Accent',
        accentColor: '#0000FF',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    // For box shape, the clip path roundRect should use radius 0
    const clipRoundRect = roundRectSpy.mock.calls.find(
      (call) =>
        call[0] === bounds.x &&
        call[1] === bounds.y &&
        call[2] === bounds.width &&
        call[3] === bounds.height &&
        call[4] === 0,
    );
    expect(clipRoundRect).toBeDefined();
    roundRectSpy.mockRestore();
  });

  it('renders identically without accentColor (backward compatible)', () => {
    const ctx = makeCanvas();
    const withoutAccent = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Same',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    const withoutAccent2 = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Same',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );

    expect(withoutAccent[0].bounds).toEqual(withoutAccent2[0].bounds);
    expect(withoutAccent[0].backgroundColor).toBe(withoutAccent2[0].backgroundColor);
    expect(withoutAccent[1].bounds).toEqual(withoutAccent2[1].bounds);
  });

  it('renders accent bar with fillOpacity < 1', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Transparent',
        accentColor: '#FF5500',
        fillOpacity: 0.5,
        opacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  for (const shape of ['rounded-box', 'box'] as const) {
    it(`renders ${shape} with accent bar and sublabel`, () => {
      const ctx = makeCanvas();
      const elements = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: `node-${shape}`,
          shape,
          label: 'Main',
          sublabel: 'subtitle',
          accentColor: '#FF5500',
          opacity: 1,
          fillOpacity: 1,
        },
        bounds,
        theme,
      );
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].kind).toBe('flow-node');
    });
  }
});
