import { type SKRSContext2D, createCanvas } from '@napi-rs/canvas';
import { describe, expect, it, vi } from 'vitest';
import { renderDrawCommands } from '../renderers/draw.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

const theme = resolveTheme('dark');

function makeCanvas() {
  const canvas = createCanvas(240, 160);
  return canvas.getContext('2d');
}

function averagePixel(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  radius = 2,
): { r: number; g: number; b: number; a: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let samples = 0;

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const pixel = ctx.getImageData(x + offsetX, y + offsetY, 1, 1).data;
      r += pixel[0];
      g += pixel[1];
      b += pixel[2];
      a += pixel[3];
      samples += 1;
    }
  }

  return {
    r: r / samples,
    g: g / samples,
    b: b / samples,
    a: a / samples,
  };
}

describe('draw stroke gradients', () => {
  it('parses strokeGradient on line and bezier commands', () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [
        {
          type: 'line',
          x1: 20,
          y1: 40,
          x2: 180,
          y2: 40,
          strokeGradient: { from: '#ff0000', to: 'rgb(0, 0, 255)' },
        },
        {
          type: 'bezier',
          points: [
            { x: 20, y: 100 },
            { x: 80, y: 40 },
            { x: 140, y: 40 },
            { x: 200, y: 100 },
          ],
          strokeGradient: { from: '#00ff00', to: 'rgba(255, 255, 255, 0.5)' },
        },
      ],
    });

    expect(spec.draw[0]).toMatchObject({
      type: 'line',
      color: '#FFFFFF',
      strokeGradient: { from: '#ff0000', to: '#0000ff' },
    });
    expect(spec.draw[1]).toMatchObject({
      type: 'bezier',
      color: '#FFFFFF',
      strokeGradient: { from: '#00ff00', to: '#ffffff80' },
    });
  });

  it('uses a linear gradient stroke for draw.line and overrides the flat color', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');

    renderDrawCommands(
      ctx,
      [
        {
          type: 'line',
          x1: 20,
          y1: 40,
          x2: 180,
          y2: 40,
          color: '#00FF00',
          strokeGradient: { from: '#FF0000', to: '#0000FF' },
          width: 12,
          arrow: 'none',
          arrowSize: 10,
          opacity: 1,
        },
      ],
      theme,
    );

    expect(gradientSpy).toHaveBeenCalledWith(20, 40, 180, 40);

    const start = averagePixel(ctx, 35, 40);
    const end = averagePixel(ctx, 165, 40);

    expect(start.a).toBeGreaterThan(0);
    expect(end.a).toBeGreaterThan(0);
    expect(start.r).toBeGreaterThan(start.b);
    expect(end.b).toBeGreaterThan(end.r);

    gradientSpy.mockRestore();
  });

  it('uses a linear gradient stroke for draw.bezier from the first point to the last point', () => {
    const ctx = makeCanvas();
    const gradientSpy = vi.spyOn(ctx, 'createLinearGradient');

    renderDrawCommands(
      ctx,
      [
        {
          type: 'bezier',
          points: [
            { x: 20, y: 110 },
            { x: 80, y: 50 },
            { x: 140, y: 50 },
            { x: 200, y: 110 },
          ],
          color: '#00FF00',
          strokeGradient: { from: '#FF0000', to: '#0000FF' },
          width: 16,
          arrow: 'none',
          arrowSize: 10,
          opacity: 1,
        },
      ],
      theme,
    );

    expect(gradientSpy).toHaveBeenCalledWith(20, 110, 200, 110);

    const start = averagePixel(ctx, 24, 106);
    const end = averagePixel(ctx, 196, 106);

    expect(start.a).toBeGreaterThan(0);
    expect(end.a).toBeGreaterThan(0);
    expect(start.r).toBeGreaterThan(start.b);
    expect(end.b).toBeGreaterThan(end.r);

    gradientSpy.mockRestore();
  });
});
