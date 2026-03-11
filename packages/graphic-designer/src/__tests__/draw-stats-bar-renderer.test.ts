import { describe, expect, it } from 'vitest';
import { renderDesign } from '../renderer.js';
import { parseDesignSpec } from '../spec.schema.js';

describe('stats-bar draw command renderer', () => {
  it('renders a single-item stats-bar', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [{ value: '150+', label: 'commits' }],
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-single',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].id).toBe('draw-0');
    expect(drawElements[0].bounds.width).toBeGreaterThan(0);
    expect(drawElements[0].bounds.height).toBeGreaterThan(0);
  });

  it('renders multi-item stats-bar with dot separators', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [
            { value: '150+', label: 'commits' },
            { value: '50+', label: 'PRs merged' },
            { value: '12', label: 'contributors' },
            { value: '99%', label: 'uptime' },
          ],
          separator: 'dot',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-multi-dot',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(rendered.png.byteLength).toBeGreaterThan(512);
    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].bounds.width).toBeGreaterThan(100);
  });

  it('renders with pipe separators', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [
            { value: '42', label: 'answers' },
            { value: '7', label: 'questions' },
          ],
          separator: 'pipe',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-pipe',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].bounds.width).toBeGreaterThan(0);
  });

  it('renders with no separators', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [
            { value: '10', label: 'repos' },
            { value: '5', label: 'packages' },
          ],
          separator: 'none',
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-none',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].bounds.width).toBeGreaterThan(0);
  });

  it('centers the stats-bar horizontally on the canvas', async () => {
    const canvasWidth = 1200;
    const spec = parseDesignSpec({
      canvas: { width: canvasWidth, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [
            { value: '100+', label: 'stars' },
            { value: '50+', label: 'forks' },
          ],
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-center',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    // The bar should be approximately centered on the canvas
    const boundsCenter = el?.bounds.x + el?.bounds.width / 2;
    expect(Math.abs(boundsCenter - canvasWidth / 2)).toBeLessThan(5);
  });

  it('applies custom colors and font sizes', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 500,
          items: [{ value: '42', label: 'everything' }],
          valueColor: '#00FF00',
          valueFontSize: 32,
          labelColor: '#FF0000',
          labelFontSize: 24,
        },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-custom',
    });
    const el = rendered.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(el).toBeTruthy();
    expect(el?.foregroundColor).toBe('#00FF00');
    expect(el?.bounds.height).toBeGreaterThan(10);
  });

  it('applies opacity', async () => {
    const specOpaque = parseDesignSpec({
      canvas: { width: 800, height: 400, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 300,
          items: [{ value: '10', label: 'items' }],
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
          type: 'stats-bar',
          y: 300,
          items: [{ value: '10', label: 'items' }],
          opacity: 0.3,
        },
      ],
    });

    const renderedOpaque = await renderDesign(specOpaque, {
      generatorVersion: 'test-stats-bar-opacity-opaque',
    });
    const renderedTransparent = await renderDesign(specTransparent, {
      generatorVersion: 'test-stats-bar-opacity-transparent',
    });

    // The two renders should produce different PNGs due to opacity difference
    expect(renderedOpaque.png.equals(renderedTransparent.png)).toBe(false);
  });

  it('coexists with other draw commands', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        { type: 'rect', x: 10, y: 10, width: 100, height: 50, fill: '#1A2547' },
        {
          type: 'stats-bar',
          y: 600,
          items: [
            { value: '150+', label: 'commits' },
            { value: '50+', label: 'PRs' },
          ],
        },
        { type: 'text', x: 400, y: 300, text: 'Hello' },
      ],
    });

    const rendered = await renderDesign(spec, {
      generatorVersion: 'test-stats-bar-coexists',
    });
    const drawElements = rendered.metadata.layout.elements.filter((el) => el.kind === 'draw');

    expect(drawElements).toHaveLength(3);
    expect(drawElements[0].id).toBe('draw-0');
    expect(drawElements[1].id).toBe('draw-1');
    expect(drawElements[2].id).toBe('draw-2');
  });

  it('wider bar with more items has wider bounds', async () => {
    const specShort = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [{ value: '1', label: 'x' }],
        },
      ],
    });
    const specWide = parseDesignSpec({
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'stats-bar',
          y: 600,
          items: [
            { value: '150+', label: 'commits' },
            { value: '50+', label: 'PRs merged' },
            { value: '12', label: 'contributors' },
          ],
        },
      ],
    });

    const renderedShort = await renderDesign(specShort, {
      generatorVersion: 'test-stats-bar-short',
    });
    const renderedWide = await renderDesign(specWide, {
      generatorVersion: 'test-stats-bar-wide',
    });

    const shortEl = renderedShort.metadata.layout.elements.find((e) => e.id === 'draw-0');
    const wideEl = renderedWide.metadata.layout.elements.find((e) => e.id === 'draw-0');

    expect(wideEl?.bounds.width).toBeGreaterThan(shortEl?.bounds.width);
  });
});
