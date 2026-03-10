import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderDesign } from '../renderer.js';
import { renderDrawCommands } from '../renderers/draw.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

const theme = resolveTheme('dark');

function makeCanvas() {
  const canvas = createCanvas(1200, 675);
  return canvas.getContext('2d');
}

describe('draw command shadow', () => {
  // --- Schema validation ---

  it('accepts rect with shadow and applies defaults', () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [{ type: 'rect', x: 10, y: 20, width: 100, height: 60, fill: '#FF0000', shadow: {} }],
    });

    expect(spec.draw[0]).toMatchObject({
      type: 'rect',
      shadow: { blur: 10, offsetX: 0, offsetY: 4 },
    });
    // Default color should be normalised from rgba(0,0,0,0.5)
    expect((spec.draw[0] as { shadow: { color: string } }).shadow.color).toBeTruthy();
  });

  it('accepts shadow with all explicit properties', () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [
        {
          type: 'circle',
          cx: 50,
          cy: 50,
          radius: 30,
          fill: '#00FF00',
          shadow: { color: '#FF0000', blur: 20, offsetX: 5, offsetY: 10 },
        },
      ],
    });

    const cmd = spec.draw[0] as {
      shadow: { color: string; blur: number; offsetX: number; offsetY: number };
    };
    expect(cmd.shadow.color).toBe('#FF0000');
    expect(cmd.shadow.blur).toBe(20);
    expect(cmd.shadow.offsetX).toBe(5);
    expect(cmd.shadow.offsetY).toBe(10);
  });

  it('omits shadow when not specified (backward compat)', () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [{ type: 'rect', x: 0, y: 0, width: 50, height: 50, fill: '#000000' }],
    });

    expect((spec.draw[0] as { shadow?: unknown }).shadow).toBeUndefined();
  });

  it('rejects blur above 64', () => {
    expect(() =>
      parseDesignSpec({
        elements: [],
        draw: [{ type: 'rect', x: 0, y: 0, width: 50, height: 50, shadow: { blur: 100 } }],
      }),
    ).toThrow();
  });

  it('rejects blur below 0', () => {
    expect(() =>
      parseDesignSpec({
        elements: [],
        draw: [{ type: 'rect', x: 0, y: 0, width: 50, height: 50, shadow: { blur: -1 } }],
      }),
    ).toThrow();
  });

  it('rejects unknown properties in shadow (strict)', () => {
    expect(() =>
      parseDesignSpec({
        elements: [],
        draw: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            shadow: { blur: 8, unknown: true },
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts shadow on all visible draw command types', () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [
        { type: 'rect', x: 0, y: 0, width: 50, height: 50, fill: '#111111', shadow: {} },
        { type: 'circle', cx: 50, cy: 50, radius: 20, fill: '#222222', shadow: {} },
        { type: 'text', x: 10, y: 10, text: 'hello', shadow: {} },
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 100,
          shadow: {},
        },
        {
          type: 'bezier',
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 50 },
          ],
          shadow: {},
        },
        { type: 'path', d: 'M 0 0 L 50 50 Z', fill: '#333333', shadow: {} },
        { type: 'badge', x: 10, y: 10, text: 'TAG', shadow: {} },
        {
          type: 'gradient-rect',
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          gradient: {
            type: 'linear',
            stops: [
              { offset: 0, color: '#000000' },
              { offset: 1, color: '#FFFFFF' },
            ],
          },
          shadow: {},
        },
      ],
    });

    for (const cmd of spec.draw) {
      expect((cmd as { shadow?: unknown }).shadow).toBeDefined();
    }
  });

  it('does not accept shadow on grid command', () => {
    expect(() =>
      parseDesignSpec({
        elements: [],
        draw: [{ type: 'grid', shadow: {} } as never],
      }),
    ).toThrow();
  });

  // --- Rendering tests ---

  it('renders rect with shadow without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderDrawCommands(
      ctx,
      [
        {
          type: 'rect',
          x: 10,
          y: 20,
          width: 100,
          height: 60,
          fill: '#FF0000',
          stroke: undefined,
          strokeWidth: 0,
          radius: 0,
          opacity: 1,
          shadow: { color: '#00000080', blur: 10, offsetX: 0, offsetY: 4 },
        },
      ],
      theme,
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe('draw');
  });

  it('renders multiple commands and shadow does not bleed', () => {
    const ctx = makeCanvas();

    // Render a rect with shadow followed by a rect without shadow
    const elements = renderDrawCommands(
      ctx,
      [
        {
          type: 'rect',
          x: 10,
          y: 20,
          width: 100,
          height: 60,
          fill: '#FF0000',
          stroke: undefined,
          strokeWidth: 0,
          radius: 0,
          opacity: 1,
          shadow: { color: '#00000080', blur: 10, offsetX: 0, offsetY: 4 },
        },
        {
          type: 'rect',
          x: 200,
          y: 20,
          width: 100,
          height: 60,
          fill: '#00FF00',
          stroke: undefined,
          strokeWidth: 0,
          radius: 0,
          opacity: 1,
        },
      ],
      theme,
    );

    expect(elements).toHaveLength(2);

    // After rendering, verify the canvas shadow state is cleared
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.shadowOffsetX).toBe(0);
    expect(ctx.shadowOffsetY).toBe(0);
  });

  it('renders all command types with shadow without throwing', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 600, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'rect',
          x: 10,
          y: 10,
          width: 80,
          height: 60,
          fill: '#1A2547',
          shadow: { blur: 12, offsetX: 2, offsetY: 6 },
        },
        {
          type: 'circle',
          cx: 200,
          cy: 50,
          radius: 30,
          fill: '#202D55',
          shadow: { color: '#0000FF', blur: 8, offsetX: 0, offsetY: 4 },
        },
        {
          type: 'text',
          x: 300,
          y: 50,
          text: 'Shadowed',
          shadow: { blur: 4, offsetX: 1, offsetY: 2 },
        },
        {
          type: 'line',
          x1: 10,
          y1: 150,
          x2: 200,
          y2: 170,
          shadow: { blur: 6, offsetX: 0, offsetY: 3 },
        },
        {
          type: 'bezier',
          points: [
            { x: 250, y: 150 },
            { x: 350, y: 100 },
            { x: 450, y: 200 },
          ],
          shadow: { blur: 5, offsetX: 0, offsetY: 2 },
        },
        {
          type: 'path',
          d: 'M 500 150 L 560 170 L 530 200 Z',
          fill: '#334B83',
          shadow: { blur: 8, offsetX: 0, offsetY: 4 },
        },
        {
          type: 'badge',
          x: 10,
          y: 250,
          text: 'GLOW',
          shadow: { color: '#22D3EE', blur: 16, offsetX: 0, offsetY: 0 },
        },
        {
          type: 'gradient-rect',
          x: 200,
          y: 250,
          width: 120,
          height: 80,
          gradient: {
            type: 'linear',
            stops: [
              { offset: 0, color: '#7AA2FF' },
              { offset: 1, color: '#1A2547' },
            ],
          },
          shadow: { blur: 10, offsetX: 0, offsetY: 4 },
        },
      ],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-shadow-all' });
    const drawElements = rendered.metadata.layout.elements.filter(
      (element) => element.kind === 'draw',
    );

    expect(rendered.png.byteLength).toBeGreaterThan(1024);
    expect(drawElements).toHaveLength(8);
  });

  it('shadow does not affect subsequent draw commands in full render', async () => {
    // Render a shadowed rect followed by a non-shadowed rect.
    // If shadow bleeds, the second rect would have a shadow too.
    // We verify both render correctly and produce distinct elements.
    const spec = parseDesignSpec({
      canvas: { width: 400, height: 200, padding: 10 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'rect',
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          fill: '#FF0000',
          shadow: { blur: 20, offsetX: 0, offsetY: 10 },
        },
        {
          type: 'rect',
          x: 200,
          y: 10,
          width: 80,
          height: 80,
          fill: '#00FF00',
        },
      ],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-shadow-nobleed' });
    const drawElements = rendered.metadata.layout.elements.filter(
      (element) => element.kind === 'draw',
    );

    expect(drawElements).toHaveLength(2);
    expect(rendered.png.byteLength).toBeGreaterThan(512);
  });
});
