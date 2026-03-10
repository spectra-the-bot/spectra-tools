import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runQa } from '../qa.js';
import { renderDesign, writeRenderArtifacts } from '../renderer.js';
import { parseDesignSpec } from '../spec.schema.js';

describe('freestyle draw layer', () => {
  it('keeps backward compatibility when draw is empty', async () => {
    const withoutDraw = parseDesignSpec({
      elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
    });
    const withEmptyDraw = parseDesignSpec({
      elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
      draw: [],
    });

    const renderedA = await renderDesign(withoutDraw, { generatorVersion: 'test-draw-backcompat' });
    const renderedB = await renderDesign(withEmptyDraw, {
      generatorVersion: 'test-draw-backcompat',
    });

    expect(renderedA.metadata.artifactHash).toBe(renderedB.metadata.artifactHash);
    expect(renderedA.png.equals(renderedB.png)).toBe(true);
  });

  it('parses draw commands with defaults', () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [
        { type: 'rect', x: 10, y: 20, width: 100, height: 60 },
        { type: 'text', x: 30, y: 40, text: 'hello' },
        {
          type: 'arc',
          center: { x: 100, y: 100 },
          radius: 40,
          startAngle: 0,
          endAngle: 180,
        },
      ],
    });

    expect(spec.draw).toHaveLength(3);
    expect(spec.draw[0]).toMatchObject({ type: 'rect', strokeWidth: 0, radius: 0, opacity: 1 });
    expect(spec.draw[1]).toMatchObject({
      type: 'text',
      fontSize: 16,
      fontWeight: 400,
      fontFamily: 'body',
      letterSpacing: 0,
      opacity: 1,
    });
    expect(spec.draw[2]).toMatchObject({
      type: 'arc',
      color: '#FFFFFF',
      width: 2,
      opacity: 1,
    });
  });

  it('renders arc command without error', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 420, height: 260, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'arc',
          center: { x: 210, y: 130 },
          radius: 80,
          startAngle: -45,
          endAngle: 180,
          color: '#22D3EE',
          width: 6,
          dash: [10, 5],
        },
      ],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-arc' });
    const drawElements = rendered.metadata.layout.elements.filter(
      (element) => element.kind === 'draw',
    );

    expect(rendered.png.byteLength).toBeGreaterThan(512);
    expect(drawElements).toHaveLength(1);
    expect(drawElements[0].id).toBe('draw-0');
  });

  it('renders all draw command types in draw-only mode', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 1000, height: 620, padding: 40 },
      theme: 'dark',
      elements: [],
      draw: [
        {
          type: 'rect',
          x: 40,
          y: 60,
          width: 140,
          height: 90,
          radius: 16,
          fill: '#1A2547',
          stroke: '#7AA2FF',
          strokeWidth: 2,
        },
        {
          type: 'circle',
          cx: 280,
          cy: 105,
          radius: 45,
          fill: '#202D55',
          stroke: '#65E4A3',
          strokeWidth: 2,
        },
        {
          type: 'text',
          x: 400,
          y: 105,
          text: 'FREESTYLE',
          fontFamily: 'heading',
          fontSize: 26,
          fontWeight: 700,
          align: 'left',
          baseline: 'alphabetic',
          letterSpacing: 2,
          color: '#E8EEFF',
        },
        {
          type: 'line',
          x1: 40,
          y1: 210,
          x2: 260,
          y2: 230,
          color: '#F4B860',
          width: 3,
          arrow: 'both',
        },
        {
          type: 'arc',
          center: { x: 380, y: 240 },
          radius: 70,
          startAngle: 215,
          endAngle: 325,
          color: '#22D3EE',
          width: 4,
          dash: [8, 4],
        },
        {
          type: 'bezier',
          points: [
            { x: 300, y: 230 },
            { x: 380, y: 180 },
            { x: 500, y: 180 },
            { x: 580, y: 230 },
          ],
          color: '#8B5CF6',
          width: 3,
          arrow: 'end',
        },
        {
          type: 'path',
          d: 'M 640 190 L 720 210 L 680 260 Z',
          fill: '#334B83',
          stroke: '#7AA2FF',
          strokeWidth: 2,
        },
        {
          type: 'badge',
          x: 760,
          y: 70,
          text: 'SCOUT',
          fontFamily: 'mono',
          fontSize: 14,
          color: '#22D3EE',
          background: '#0D4040',
          paddingX: 10,
          paddingY: 4,
          borderRadius: 14,
        },
        {
          type: 'gradient-rect',
          x: 760,
          y: 150,
          width: 180,
          height: 90,
          radius: 12,
          gradient: {
            type: 'linear',
            angle: 90,
            stops: [
              { offset: 0, color: '#7AA2FF' },
              { offset: 1, color: '#1A2547' },
            ],
          },
        },
      ],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-all' });
    const drawElements = rendered.metadata.layout.elements.filter(
      (element) => element.kind === 'draw',
    );

    expect(rendered.png.byteLength).toBeGreaterThan(1024);
    expect(drawElements).toHaveLength(9);
    expect(drawElements.map((element) => element.id)).toEqual([
      'draw-0',
      'draw-1',
      'draw-2',
      'draw-3',
      'draw-4',
      'draw-5',
      'draw-6',
      'draw-7',
      'draw-8',
    ]);
  });

  it('renders draw commands after structured elements and before vignettes', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 960, height: 540, padding: 40 },
      theme: 'dark',
      decorators: [{ type: 'vignette', intensity: 0.3 }],
      elements: [{ type: 'card', id: 'card-1', title: 'Card', body: 'Body' }],
      draw: [{ type: 'text', x: 480, y: 280, text: 'overlay', align: 'center' }],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-order' });
    const ids = rendered.metadata.layout.elements.map((element) => element.id);

    expect(ids.indexOf('draw-0')).toBeGreaterThan(
      ids.findIndex((id) => id.startsWith('card-card-1')),
    );
    expect(ids.indexOf('draw-0')).toBeLessThan(ids.indexOf('decorator-vignette-0'));
  });

  it('measures badge/text and honors letter spacing metadata', async () => {
    const spec = parseDesignSpec({
      elements: [],
      draw: [
        {
          type: 'text',
          x: 80,
          y: 120,
          text: 'SPACING',
          align: 'left',
          letterSpacing: 0,
          fontSize: 24,
        },
        {
          type: 'text',
          x: 80,
          y: 170,
          text: 'SPACING',
          align: 'left',
          letterSpacing: 6,
          fontSize: 24,
        },
        {
          type: 'badge',
          x: 80,
          y: 220,
          text: 'TAG',
          fontSize: 16,
          paddingX: 12,
          paddingY: 6,
        },
      ],
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-measure' });
    const normal = rendered.metadata.layout.elements.find((element) => element.id === 'draw-0');
    const spaced = rendered.metadata.layout.elements.find((element) => element.id === 'draw-1');
    const badge = rendered.metadata.layout.elements.find((element) => element.id === 'draw-2');

    expect(normal).toBeTruthy();
    expect(spaced).toBeTruthy();
    expect(badge).toBeTruthy();
    expect(spaced?.bounds.width ?? 0).toBeGreaterThan(normal?.bounds.width ?? 0);
    expect(badge?.bounds.width ?? 0).toBeGreaterThan(32);
    expect(badge?.bounds.height ?? 0).toBeGreaterThan(20);
  });

  it('reports out-of-bounds draw commands as warnings in QA', async () => {
    const spec = parseDesignSpec({
      canvas: { width: 320, height: 180, padding: 20 },
      theme: 'dark',
      elements: [],
      draw: [
        { type: 'rect', x: 280, y: 140, width: 80, height: 60, fill: '#1A2547' },
        { type: 'text', x: 40, y: 80, text: 'ok' },
      ],
    });

    const render = await renderDesign(spec, { generatorVersion: 'test-draw-qa' });
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-draw-qa-'));
    const written = await writeRenderArtifacts(render, dir);

    const report = await runQa({
      imagePath: written.imagePath,
      spec,
      metadata: render.metadata,
    });

    expect(report.issues.some((issue) => issue.code === 'DRAW_OUT_OF_BOUNDS')).toBe(true);
    expect(
      report.issues.some(
        (issue) => issue.code === 'DRAW_OUT_OF_BOUNDS' && issue.severity === 'warning',
      ),
    ).toBe(true);
  });

  describe('grid draw command', () => {
    it('parses grid command with all defaults', () => {
      const spec = parseDesignSpec({
        elements: [],
        draw: [{ type: 'grid' }],
      });

      expect(spec.draw).toHaveLength(1);
      expect(spec.draw[0]).toMatchObject({
        type: 'grid',
        spacing: 40,
        width: 0.5,
        opacity: 0.2,
        offsetX: 0,
        offsetY: 0,
      });
    });

    it('parses grid command with custom values', () => {
      const spec = parseDesignSpec({
        elements: [],
        draw: [
          {
            type: 'grid',
            spacing: 80,
            color: '#FF0000',
            width: 2,
            opacity: 0.5,
            offsetX: 10,
            offsetY: 20,
          },
        ],
      });

      expect(spec.draw[0]).toMatchObject({
        type: 'grid',
        spacing: 80,
        width: 2,
        opacity: 0.5,
        offsetX: 10,
        offsetY: 20,
      });
    });

    it('rejects extra fields on grid command (strict)', () => {
      expect(() =>
        parseDesignSpec({
          elements: [],
          draw: [{ type: 'grid', spacing: 40, extraField: true }],
        }),
      ).toThrow();
    });

    it('rejects spacing below minimum', () => {
      expect(() =>
        parseDesignSpec({
          elements: [],
          draw: [{ type: 'grid', spacing: 2 }],
        }),
      ).toThrow();
    });

    it('rejects spacing above maximum', () => {
      expect(() =>
        parseDesignSpec({
          elements: [],
          draw: [{ type: 'grid', spacing: 300 }],
        }),
      ).toThrow();
    });

    it('rejects width above maximum', () => {
      expect(() =>
        parseDesignSpec({
          elements: [],
          draw: [{ type: 'grid', width: 10 }],
        }),
      ).toThrow();
    });

    it('renders grid command and produces draw element', async () => {
      const spec = parseDesignSpec({
        canvas: { width: 400, height: 300, padding: 20 },
        theme: 'dark',
        elements: [],
        draw: [{ type: 'grid', spacing: 50, color: '#334B83', width: 1, opacity: 0.3 }],
      });

      const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-grid' });
      const drawElements = rendered.metadata.layout.elements.filter(
        (element) => element.kind === 'draw',
      );

      expect(rendered.png.byteLength).toBeGreaterThan(512);
      expect(drawElements).toHaveLength(1);
      expect(drawElements[0].id).toBe('draw-0');
      expect(drawElements[0].bounds).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    });

    it('renders grid alongside other draw commands', async () => {
      const spec = parseDesignSpec({
        canvas: { width: 600, height: 400, padding: 20 },
        theme: 'dark',
        elements: [],
        draw: [
          { type: 'grid', spacing: 40 },
          { type: 'rect', x: 50, y: 50, width: 100, height: 80, fill: '#1A2547' },
          { type: 'text', x: 100, y: 200, text: 'over grid' },
        ],
      });

      const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-grid-combo' });
      const drawElements = rendered.metadata.layout.elements.filter(
        (element) => element.kind === 'draw',
      );

      expect(drawElements).toHaveLength(3);
      expect(drawElements[0].id).toBe('draw-0');
      expect(drawElements[1].id).toBe('draw-1');
      expect(drawElements[2].id).toBe('draw-2');
    });

    it('renders grid with offsets', async () => {
      const spec = parseDesignSpec({
        canvas: { width: 400, height: 300, padding: 10 },
        theme: 'dark',
        elements: [],
        draw: [{ type: 'grid', spacing: 40, offsetX: 15, offsetY: 25 }],
      });

      const rendered = await renderDesign(spec, { generatorVersion: 'test-draw-grid-offset' });
      expect(rendered.png.byteLength).toBeGreaterThan(512);

      const drawElements = rendered.metadata.layout.elements.filter(
        (element) => element.kind === 'draw',
      );
      expect(drawElements).toHaveLength(1);
    });
  });
});
