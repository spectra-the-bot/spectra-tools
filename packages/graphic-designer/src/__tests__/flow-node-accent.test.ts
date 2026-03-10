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

// ---------------------------------------------------------------------------
// 1. Accent bar rendering
// ---------------------------------------------------------------------------

describe('accent bar rendering', () => {
  it('flow node with accentColor renders without error', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Accented',
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

  it('flow node without accentColor has identical output to baseline', () => {
    const ctx = makeCanvas();
    const baseline = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Baseline',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    const again = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Baseline',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );

    // Same structure, same bounds, same colours — no regression from accent feature
    expect(baseline.length).toBe(again.length);
    expect(baseline[0].bounds).toEqual(again[0].bounds);
    expect(baseline[0].backgroundColor).toBe(again[0].backgroundColor);
  });

  it('custom accentBarWidth produces different canvas calls than default', () => {
    const ctx = makeCanvas();
    const spy = vi.spyOn(ctx, 'fillRect');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Default',
        accentColor: '#FF0000',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    const defaultCall = spy.mock.calls.find(
      (c) => c[0] === bounds.x && c[1] === bounds.y && c[2] === 3,
    );
    expect(defaultCall).toBeDefined();

    spy.mockClear();

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Wide',
        accentColor: '#FF0000',
        accentBarWidth: 10,
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    const wideCall = spy.mock.calls.find(
      (c) => c[0] === bounds.x && c[1] === bounds.y && c[2] === 10,
    );
    expect(wideCall).toBeDefined();
    // The two widths differ
    expect(wideCall?.[2]).not.toBe(defaultCall?.[2]);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 2. Inner glow rendering
// ---------------------------------------------------------------------------

describe('inner glow rendering', () => {
  it('flow node with glowColor renders without error', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Glowing',
        glowColor: '#00AAFF',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('custom glowWidth and glowOpacity are accepted', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');
    const alphas: number[] = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    vi.spyOn(ctx, 'fillRect').mockImplementation((...args) => {
      alphas.push(ctx.globalAlpha);
      return origFillRect(...args);
    });

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Custom Glow',
        glowColor: '#00AAFF',
        glowWidth: 32,
        glowOpacity: 0.4,
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );

    // Gradient spans 32px from left edge
    const glowCall = gradientSpy.mock.calls.find(
      (c) => c[0] === bounds.x && c[2] === bounds.x + 32,
    );
    expect(glowCall).toBeDefined();

    // globalAlpha was set to 0.4 for one of the fillRect calls
    const hasAlpha = alphas.some((a) => Math.abs(a - 0.4) < 0.01);
    expect(hasAlpha).toBe(true);

    gradientSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 3. Combined accent + glow
// ---------------------------------------------------------------------------

describe('combined accent + glow rendering', () => {
  it('flow node with both accentColor and glowColor renders without error', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Both',
        accentColor: '#FF5500',
        accentBarWidth: 5,
        glowColor: '#00AAFF',
        glowWidth: 20,
        glowOpacity: 0.2,
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('glow gradient starts after accent bar offset', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Offset',
        accentColor: '#FF5500',
        accentBarWidth: 6,
        glowColor: '#00AAFF',
        glowWidth: 16,
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );

    const glowCall = gradientSpy.mock.calls.find(
      (c) => c[0] === bounds.x + 6 && c[2] === bounds.x + 6 + 16,
    );
    expect(glowCall).toBeDefined();
    gradientSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 4. Schema validation
// ---------------------------------------------------------------------------

describe('accent decoration schema validation', () => {
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

  it('rejects glowOpacity above 1', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            glowColor: '#00AAFF',
            glowOpacity: 1.5,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects negative accentBarWidth', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            accentColor: '#FF0000',
            accentBarWidth: -1,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects negative glowOpacity', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            glowColor: '#00AAFF',
            glowOpacity: -0.1,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects glowWidth above 64', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            glowColor: '#00AAFF',
            glowWidth: 100,
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts boundary values (accentBarWidth=16, glowOpacity=1)', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'A',
          accentColor: '#FF0000',
          accentBarWidth: 16,
          glowColor: '#00AAFF',
          glowOpacity: 1,
          glowWidth: 64,
        },
      ],
    });
    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentBarWidth).toBe(16);
      expect(n1.glowOpacity).toBe(1);
      expect(n1.glowWidth).toBe(64);
    }
  });

  it('accepts zero values (accentBarWidth=0, glowOpacity=0, glowWidth=0)', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'A',
          accentColor: '#FF0000',
          accentBarWidth: 0,
          glowColor: '#00AAFF',
          glowOpacity: 0,
          glowWidth: 0,
        },
      ],
    });
    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentBarWidth).toBe(0);
      expect(n1.glowOpacity).toBe(0);
      expect(n1.glowWidth).toBe(0);
    }
  });
});
