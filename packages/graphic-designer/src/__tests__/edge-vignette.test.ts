import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { drawEdgeVignette } from '../primitives/gradients.js';
import { renderDesign } from '../renderer.js';
import { parseDesignSpec } from '../spec.schema.js';

describe('edge vignette schema', () => {
  it('defaults mode to radial when not specified', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
      decorators: [{ type: 'vignette' }],
    });

    const vignette = spec.decorators[0];
    expect(vignette.type).toBe('vignette');
    if (vignette.type === 'vignette') {
      expect(vignette.mode).toBe('radial');
    }
  });

  it('accepts edge mode with defaults', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
      decorators: [{ type: 'vignette', mode: 'edge' }],
    });

    const vignette = spec.decorators[0];
    expect(vignette.type).toBe('vignette');
    if (vignette.type === 'vignette') {
      expect(vignette.mode).toBe('edge');
      expect(vignette.edgeTopHeight).toBe(35);
      expect(vignette.edgeBottomHeight).toBe(55);
      expect(vignette.edgeTopOpacity).toBe(0.3);
      expect(vignette.edgeBottomOpacity).toBe(0.4);
    }
  });

  it('accepts custom edge heights and opacities', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
      decorators: [
        {
          type: 'vignette',
          mode: 'edge',
          edgeTopHeight: 50,
          edgeBottomHeight: 80,
          edgeTopOpacity: 0.5,
          edgeBottomOpacity: 0.6,
        },
      ],
    });

    const vignette = spec.decorators[0];
    if (vignette.type === 'vignette') {
      expect(vignette.edgeTopHeight).toBe(50);
      expect(vignette.edgeBottomHeight).toBe(80);
      expect(vignette.edgeTopOpacity).toBe(0.5);
      expect(vignette.edgeBottomOpacity).toBe(0.6);
    }
  });

  it('rejects edgeTopHeight above 200', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
        decorators: [{ type: 'vignette', mode: 'edge', edgeTopHeight: 250 }],
      }),
    ).toThrow();
  });

  it('rejects edgeBottomOpacity above 1', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
        decorators: [{ type: 'vignette', mode: 'edge', edgeBottomOpacity: 1.5 }],
      }),
    ).toThrow();
  });

  it('rejects negative edgeBottomHeight', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
        decorators: [{ type: 'vignette', mode: 'edge', edgeBottomHeight: -10 }],
      }),
    ).toThrow();
  });
});

describe('drawEdgeVignette primitive', () => {
  it('renders top edge darker than centre', () => {
    const canvas = createCanvas(240, 200);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 240, 200);

    drawEdgeVignette(ctx, 240, 200, '#000000', 50, 50, 0.8, 0.8);

    const topPixel = ctx.getImageData(120, 2, 1, 1).data;
    const centerPixel = ctx.getImageData(120, 100, 1, 1).data;

    const topLuma = topPixel[0] + topPixel[1] + topPixel[2];
    const centerLuma = centerPixel[0] + centerPixel[1] + centerPixel[2];

    expect(topLuma).toBeLessThan(centerLuma);
  });

  it('renders bottom edge darker than centre', () => {
    const canvas = createCanvas(240, 200);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 240, 200);

    drawEdgeVignette(ctx, 240, 200, '#000000', 50, 50, 0.8, 0.8);

    const bottomPixel = ctx.getImageData(120, 197, 1, 1).data;
    const centerPixel = ctx.getImageData(120, 100, 1, 1).data;

    const bottomLuma = bottomPixel[0] + bottomPixel[1] + bottomPixel[2];
    const centerLuma = centerPixel[0] + centerPixel[1] + centerPixel[2];

    expect(bottomLuma).toBeLessThan(centerLuma);
  });

  it('leaves centre untouched', () => {
    const canvas = createCanvas(240, 200);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 240, 200);

    drawEdgeVignette(ctx, 240, 200, '#000000', 40, 40, 0.5, 0.5);

    const centerPixel = ctx.getImageData(120, 100, 1, 1).data;

    // Centre should remain white (255)
    expect(centerPixel[0]).toBe(255);
    expect(centerPixel[1]).toBe(255);
    expect(centerPixel[2]).toBe(255);
  });

  it('is a no-op for zero dimensions', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 100, 100);

    // Should not throw
    drawEdgeVignette(ctx, 0, 100, '#000000');
    drawEdgeVignette(ctx, 100, 0, '#000000');

    const pixel = ctx.getImageData(50, 50, 1, 1).data;
    expect(pixel[0]).toBe(255);
  });

  it('skips top when topHeight is zero', () => {
    const canvas = createCanvas(240, 200);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 240, 200);

    drawEdgeVignette(ctx, 240, 200, '#000000', 0, 50, 0.8, 0.8);

    // Top should remain white since topHeight is 0
    const topPixel = ctx.getImageData(120, 2, 1, 1).data;
    expect(topPixel[0]).toBe(255);
  });
});

describe('edge vignette renderer integration', () => {
  it('renders edge vignette at the same pipeline stage as radial', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 960, height: 540, padding: 48 },
      theme: 'dark',
      elements: [{ type: 'card', id: 'card1', title: 'A', body: 'B' }],
      layout: {
        mode: 'manual',
        positions: {
          card1: { x: 80, y: 180, width: 320, height: 180 },
        },
      },
      decorators: [{ type: 'vignette', mode: 'edge' }],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-edge-vignette' });

    const ids = rendered.metadata.layout.elements.map((el) => el.id);
    const vignetteIndex = ids.indexOf('decorator-vignette-0');
    const cardIndex = ids.findIndex((id) => id.startsWith('card-card1'));

    expect(vignetteIndex).toBeGreaterThanOrEqual(0);
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    // Edge vignette should render after cards (final overlay), just like radial
    expect(vignetteIndex).toBeGreaterThan(cardIndex);
  });

  it('produces valid PNG with edge vignette', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 640, height: 360, padding: 32 },
      theme: 'dark',
      elements: [{ type: 'card', id: 'c1', title: 'Test', body: 'Edge vignette test' }],
      layout: {
        mode: 'manual',
        positions: { c1: { x: 50, y: 50, width: 200, height: 120 } },
      },
      decorators: [
        {
          type: 'vignette',
          mode: 'edge',
          edgeTopHeight: 40,
          edgeBottomHeight: 60,
          edgeTopOpacity: 0.3,
          edgeBottomOpacity: 0.4,
        },
      ],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-edge-png' });

    expect(rendered.png.byteLength).toBeGreaterThan(1024);
    expect(rendered.metadata.artifactHash).toBeTruthy();
  });
});
