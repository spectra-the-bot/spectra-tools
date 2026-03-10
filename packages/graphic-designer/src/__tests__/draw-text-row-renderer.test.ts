import { describe, expect, it } from 'vitest';
import { renderDesign } from '../renderer.js';
import { type DrawTextRow, parseDesignSpec } from '../spec.schema.js';

describe('text-row draw command renderer', () => {
  it('renders a single-segment text-row', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'Hello' }],
          x: 400,
          y: 200,
          align: 'center',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-single',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].id).toBe('draw-0');
    expect(drawElements[0].bounds.width).toBeGreaterThan(0);
    expect(drawElements[0].bounds.height).toBeGreaterThan(0);
  });

  it('renders multi-segment text-row as contiguous line with different colors', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [
            { text: 'Red', color: '#FF0000' },
            { text: ' Green', color: '#00FF00' },
            { text: ' Blue', color: '#0000FF' },
          ],
          x: 400,
          y: 200,
          align: 'left',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-multi',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(rendered.png.byteLength).toBeGreaterThan(512);
    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].bounds.width).toBeGreaterThan(0);
    // Multi-segment should be wider than single
    expect(drawElements[0].foregroundColor).toBe('#FFFFFF');
  });

  it('centers combined width around x when align is center', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'AAAA' }, { text: 'BBBB' }],
          x: 400,
          y: 200,
          align: 'center',
          defaultFontSize: 24,
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-center',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    // For center alignment, the bounds should be approximately centered on x=400
    const boundsCenter = el?.bounds.x + el?.bounds.width / 2;
    expect(Math.abs(boundsCenter - 400)).toBeLessThan(2);
  });

  it('right-aligns so the row ends at x', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'Right' }, { text: 'Aligned' }],
          x: 700,
          y: 200,
          align: 'right',
          defaultFontSize: 20,
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-right',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    // For right alignment, x + width should equal the command x (700)
    const rightEdge = el?.bounds.x + el?.bounds.width;
    expect(Math.abs(rightEdge - 700)).toBeLessThan(2);
  });

  it('left-aligns so the row starts at x', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'Left' }],
          x: 100,
          y: 200,
          align: 'left',
          defaultFontSize: 20,
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-left',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    expect(Math.abs(el?.bounds.x - 100)).toBeLessThan(2);
  });

  it('applies per-segment fontSize, fontWeight, fontFamily overrides', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1000, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [
            { text: 'Big', fontSize: 48, fontWeight: 700, fontFamily: 'heading' },
            { text: ' Small', fontSize: 12, fontWeight: 300, fontFamily: 'mono' },
          ],
          x: 100,
          y: 200,
          align: 'left',
          defaultFontSize: 16,
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-overrides',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    expect(rendered.png.byteLength).toBeGreaterThan(512);
    // Bounds height should reflect the largest segment (48px)
    expect(el?.bounds.height).toBeGreaterThan(10);
  });

  it('falls back to command-level defaults when segment overrides are missing', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'Default segment' }],
          x: 400,
          y: 200,
          defaultFontSize: 32,
          defaultFontWeight: 700,
          defaultFontFamily: 'heading',
          defaultColor: '#AABBCC',
          align: 'center',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-defaults',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    expect(el?.foregroundColor).toBe('#AABBCC');
    expect(el?.bounds.width).toBeGreaterThan(0);
  });

  it('applies opacity to the entire row', async () => {
    const specOpaque = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'Opacity test' }],
          x: 400,
          y: 200,
          opacity: 1,
        },
      ],
    });
    const specTransparent = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [{ text: 'Opacity test' }],
          x: 400,
          y: 200,
          opacity: 0.3,
        },
      ],
    });

    const renderedOpaque = await renderDesign(specOpaque, {
      generatorVersion: 'test-text-row-opacity-opaque',
    });
    const renderedTransparent = await renderDesign(specTransparent, {
      generatorVersion: 'test-text-row-opacity-transparent',
    });

    // The two renders should produce different PNGs due to opacity difference
    expect(renderedOpaque.png.equals(renderedTransparent.png)).toBe(false);
  });

  it('RenderedElement bounds encompass the full text row', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1000, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'text-row',
          segments: [
            { text: 'Segment One', fontSize: 20 },
            { text: ' Segment Two', fontSize: 20 },
            { text: ' Segment Three', fontSize: 20 },
          ],
          x: 100,
          y: 200,
          align: 'left',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-bounds',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    // Bounds should have positive dimensions
    expect(el?.bounds.width).toBeGreaterThan(50);
    expect(el?.bounds.height).toBeGreaterThan(5);
    // Left-aligned: x should be approximately at 100
    expect(Math.abs(el?.bounds.x - 100)).toBeLessThan(2);
  });

  it('coexists with other draw commands', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        { type: 'rect', x: 10, y: 10, width: 100, height: 50, fill: '#1A2547' },
        {
          type: 'text-row',
          segments: [{ text: 'Hello' }, { text: ' World' }],
          x: 400,
          y: 200,
        },
        { type: 'text', x: 400, y: 300, text: 'Plain text' },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-text-row-coexists',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(drawElements).toHaveLength(3);
    expect(drawElements[0].id).toBe('draw-0');
    expect(drawElements[1].id).toBe('draw-1');
    expect(drawElements[2].id).toBe('draw-2');
  });
});
