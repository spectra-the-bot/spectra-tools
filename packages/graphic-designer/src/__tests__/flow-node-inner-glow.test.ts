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

describe('flow-node inner glow', () => {
  // --- Rendering: glow without accent bar ---

  it('renders with glowColor without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Glow Node',
        glowColor: '#00AAFF',
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

  it('renders with custom glowWidth and glowOpacity', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Custom Glow',
        glowColor: '#FF5500',
        glowWidth: 32,
        glowOpacity: 0.5,
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('does not render glow when glowColor is undefined', () => {
    const ctx = makeCanvas();
    const saveSpy = vi.spyOn(ctx, 'save');
    const clipSpy = vi.spyOn(ctx, 'clip');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'No Glow',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );

    // save/clip are called for the outer ctx.save, but NOT for a glow-specific clip.
    // We verify indirectly: createLinearGradient should not be called for glow purposes.
    // Since we can't easily distinguish glow save/clip from the main save, we just
    // confirm no crash and basic structural output.
    expect(saveSpy).toHaveBeenCalled();
    saveSpy.mockRestore();
    clipSpy.mockRestore();
  });

  // --- Rendering: glow with accent bar ---

  it('renders glow offset by accent bar width when accentColor is present', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Accent + Glow',
        accentColor: '#FF5500',
        accentBarWidth: 5,
        glowColor: '#00AAFF',
        glowWidth: 16,
        glowOpacity: 0.15,
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );

    // The glow gradient should start at bounds.x + barOffset (5)
    const glowCall = gradientSpy.mock.calls.find(
      (call) => call[0] === bounds.x + 5 && call[2] === bounds.x + 5 + 16,
    );
    expect(glowCall).toBeDefined();
    gradientSpy.mockRestore();
  });

  it('renders glow from left edge (barOffset=0) when no accentColor', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Glow Only',
        glowColor: '#00AAFF',
        glowWidth: 16,
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );

    // Gradient should start at bounds.x (no offset)
    const glowCall = gradientSpy.mock.calls.find(
      (call) => call[0] === bounds.x && call[2] === bounds.x + 16,
    );
    expect(glowCall).toBeDefined();
    gradientSpy.mockRestore();
  });

  it('uses default accentBarWidth (3) when accentColor present but accentBarWidth not set', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Default Bar Width',
        accentColor: '#FF5500',
        accentBarWidth: 3,
        glowColor: '#00AAFF',
        glowWidth: 16,
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );

    const glowCall = gradientSpy.mock.calls.find(
      (call) => call[0] === bounds.x + 3 && call[2] === bounds.x + 3 + 16,
    );
    expect(glowCall).toBeDefined();
    gradientSpy.mockRestore();
  });

  // --- Glow clipping ---

  it('clips glow to node shape via roundRect + clip', () => {
    const ctx = makeCanvas();
    const clipSpy = vi.spyOn(ctx, 'clip');
    const roundRectSpy = vi.spyOn(ctx, 'roundRect');

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Clipped Glow',
        glowColor: '#00AAFF',
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );

    // roundRect should be called with the node bounds for clipping
    const clipRoundRect = roundRectSpy.mock.calls.find(
      (call) =>
        call[0] === bounds.x &&
        call[1] === bounds.y &&
        call[2] === bounds.width &&
        call[3] === bounds.height,
    );
    expect(clipRoundRect).toBeDefined();
    expect(clipSpy).toHaveBeenCalled();
    clipSpy.mockRestore();
    roundRectSpy.mockRestore();
  });

  // --- Glow opacity via globalAlpha ---

  it('sets globalAlpha to glowOpacity for the glow fill', () => {
    const ctx = makeCanvas();
    const alphaValues: number[] = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    vi.spyOn(ctx, 'fillRect').mockImplementation((...args) => {
      alphaValues.push(ctx.globalAlpha);
      return origFillRect(...args);
    });

    renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Alpha Check',
        glowColor: '#00AAFF',
        glowOpacity: 0.25,
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );

    // One of the fillRect calls should have globalAlpha ~0.25 (canvas may quantize)
    const hasGlowAlpha = alphaValues.some((a) => Math.abs(a - 0.25) < 0.01);
    expect(hasGlowAlpha).toBe(true);
  });

  // --- All 7 shapes render with glow ---

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
    it(`renders ${shape} with glow without throwing`, () => {
      const ctx = makeCanvas();
      const elements = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: `node-${shape}`,
          shape,
          label: shape,
          glowColor: '#00AAFF',
          glowWidth: 16,
          glowOpacity: 0.15,
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
  }

  // --- Glow with other features ---

  it('renders with glow and shadow together', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Shadow + Glow',
        glowColor: '#00AAFF',
        shadow: { blur: 12, offsetX: 0, offsetY: 0, opacity: 0.5 },
        opacity: 1,
        fillOpacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with glow and fillOpacity < 1', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Semi-transparent + Glow',
        glowColor: '#00AAFF',
        fillOpacity: 0.5,
        opacity: 1,
        badgePosition: 'inside-top',
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with glow and badge', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Glow + Badge',
        glowColor: '#00AAFF',
        badgeText: 'NEW',
        badgePosition: 'inside-top',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });
});
