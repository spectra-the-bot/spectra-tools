import { describe, expect, it } from 'vitest';
import { parseDesignSpec } from '../spec.schema.js';

describe('design spec schema v2', () => {
  it('parses a mixed element spec', () => {
    const spec = parseDesignSpec({
      version: 2,
      canvas: { width: 1200, height: 675, padding: 48 },
      theme: 'dark',
      header: {
        title: 'Architecture',
      },
      elements: [
        {
          type: 'card',
          id: 'card-1',
          title: 'Card',
          body: 'Body copy',
          tone: 'accent',
        },
        {
          type: 'flow-node',
          id: 'node-1',
          shape: 'rounded-box',
          label: 'Start',
        },
        {
          type: 'connection',
          from: 'node-1',
          to: 'node-2',
          arrow: 'end',
        },
        {
          type: 'code-block',
          id: 'code-1',
          code: 'console.log("hi")',
          language: 'typescript',
        },
        {
          type: 'terminal',
          id: 'term-1',
          content: 'npm run build\nDone',
          style: {
            windowControls: 'macos',
          },
        },
        {
          type: 'text',
          id: 'text-1',
          content: 'Free text',
          style: 'caption',
        },
        {
          type: 'shape',
          id: 'shape-1',
          shape: 'rectangle',
          fill: '#112233',
        },
      ],
      layout: {
        mode: 'auto',
        direction: 'LR',
        nodeSpacing: 72,
        rankSpacing: 96,
      },
      constraints: {
        minContrastRatio: 4.5,
        minFooterSpacing: 16,
        checkOverlaps: true,
        maxTextTruncation: 0.1,
      },
    });

    expect(spec.version).toBe(2);
    expect(spec.elements).toHaveLength(7);
    expect(spec.layout.mode).toBe('auto');
  });

  it('applies defaults for optional properties', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'card',
          id: 'a',
          title: 'A',
          body: 'B',
        },
      ],
    });

    expect(spec.version).toBe(2);
    expect(spec.canvas.width).toBe(1200);
    expect(spec.theme).toBe('dark');
    expect(spec.layout.mode).toBe('grid');
    expect(spec.constraints.maxTextTruncation).toBe(0.1);
    expect(spec.decorators).toEqual([]);
    expect(spec.background).toBeUndefined();
  });

  it('parses gradient backgrounds and decorator defaults', () => {
    const spec = parseDesignSpec({
      theme: 'dark',
      background: {
        type: 'linear',
        stops: [
          { offset: 0, color: '#0B1020' },
          { offset: 1, color: '#1A2547' },
        ],
      },
      elements: [{ type: 'card', id: 'a', title: 'A', body: 'B' }],
      decorators: [{ type: 'vignette' }, { type: 'rainbow-rule' }],
    });

    expect(spec.background).toEqual({
      type: 'linear',
      angle: 180,
      stops: [
        { offset: 0, color: '#0B1020' },
        { offset: 1, color: '#1A2547' },
      ],
    });
    expect(spec.decorators[0]).toEqual({
      type: 'vignette',
      mode: 'radial',
      intensity: 0.3,
      color: '#000000',
      edgeTopHeight: 35,
      edgeBottomHeight: 55,
      edgeTopOpacity: 0.3,
      edgeBottomOpacity: 0.4,
    });
    expect(spec.decorators[1]).toEqual({
      type: 'rainbow-rule',
      y: 'after-header',
      thickness: 2,
      margin: 16,
    });
  });

  it('infers layout mode when not explicitly provided', () => {
    const flowSpec = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'n1', shape: 'box', label: 'Start' },
        { type: 'flow-node', id: 'n2', shape: 'box', label: 'End' },
        { type: 'connection', from: 'n1', to: 'n2' },
      ],
    });

    const codeSpec = parseDesignSpec({
      elements: [{ type: 'code-block', id: 'code', language: 'ts', code: 'console.log(1);' }],
    });

    const explicitGrid = parseDesignSpec({
      elements: [{ type: 'code-block', id: 'code', language: 'ts', code: 'console.log(1);' }],
      layout: { mode: 'grid', columns: 2, gap: 20, equalHeight: true },
    });

    expect(flowSpec.layout.mode).toBe('auto');
    expect(codeSpec.layout.mode).toBe('stack');
    expect(explicitGrid.layout.mode).toBe('grid');
  });

  it('parses image elements with defaults', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'image',
          id: 'hero',
          src: 'https://example.com/hero.png',
        },
      ],
    });

    expect(spec.elements[0]).toMatchObject({
      type: 'image',
      id: 'hero',
      src: 'https://example.com/hero.png',
      fit: 'contain',
      borderRadius: 0,
    });
  });

  it('accepts draw-only specs with no structured elements', () => {
    const spec = parseDesignSpec({
      draw: [
        { type: 'rect', x: 10, y: 10, width: 80, height: 40, fill: '#112233' },
        { type: 'text', x: 20, y: 30, text: 'hello' },
      ],
    });

    expect(spec.elements).toEqual([]);
    expect(spec.draw).toHaveLength(2);
    expect(spec.layout.mode).toBe('grid');
  });

  it('supports enhanced header, flow-node, connection, and auto-layout schema fields', () => {
    const spec = parseDesignSpec({
      header: {
        title: 'Enhanced Header',
        align: 'center',
        titleLetterSpacing: 4,
        titleFontSize: 36,
      },
      layout: {
        mode: 'auto',
        algorithm: 'stress',
        direction: 'LR',
        nodeSpacing: 64,
        rankSpacing: 96,
        edgeRouting: 'spline',
        aspectRatio: 1.78,
        diagramCenter: { x: 420, y: 210 },
      },
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'rounded-box',
          label: 'A',
          sublabel: 'details',
          sublabelColor: '#8899AA',
          labelColor: '#FFFFFF',
          labelFontSize: 24,
          borderWidth: 3,
          cornerRadius: 24,
          width: 220,
          height: 100,
          opacity: 0.9,
        },
        {
          type: 'flow-node',
          id: 'n2',
          shape: 'diamond',
          label: 'B',
        },
        {
          type: 'connection',
          from: 'n1',
          to: 'n2',
          routing: 'arc',
          width: 3,
          arrowSize: 14,
          opacity: 0.7,
        },
      ],
    });

    expect(spec.header?.align).toBe('center');
    expect(spec.header?.titleLetterSpacing).toBe(4);
    expect(spec.header?.titleFontSize).toBe(36);
    expect(spec.layout.mode).toBe('auto');
    if (spec.layout.mode === 'auto') {
      expect(spec.layout.algorithm).toBe('stress');
      expect(spec.layout.edgeRouting).toBe('spline');
      expect(spec.layout.aspectRatio).toBe(1.78);
      expect(spec.layout.diagramCenter).toEqual({ x: 420, y: 210 });
    }

    const node = spec.elements.find(
      (element) => element.type === 'flow-node' && element.id === 'n1',
    );
    expect(node).toBeDefined();
    if (node?.type === 'flow-node') {
      expect(node.sublabelColor).toBe('#8899AA');
      expect(node.labelColor).toBe('#FFFFFF');
      expect(node.labelFontSize).toBe(24);
      expect(node.borderWidth).toBe(3);
      expect(node.cornerRadius).toBe(24);
      expect(node.width).toBe(220);
      expect(node.height).toBe(100);
      expect(node.opacity).toBe(0.9);
    }

    const connection = spec.elements.find((element) => element.type === 'connection');
    expect(connection).toBeDefined();
    if (connection?.type === 'connection') {
      expect(connection.routing).toBe('arc');
      expect(connection.width).toBe(3);
      expect(connection.arrowSize).toBe(14);
      expect(connection.opacity).toBe(0.7);
    }
  });

  it('accepts segmented header titles with per-segment colors', () => {
    const spec = parseDesignSpec({
      header: {
        title: [
          { text: 'spectra', color: '#3B82F6' },
          { text: ' tools', color: 'rgb(255,255,255)' },
        ],
      },
      elements: [],
    });

    expect(Array.isArray(spec.header?.title)).toBe(true);
    if (Array.isArray(spec.header?.title)) {
      expect(spec.header.title).toEqual([
        { text: 'spectra', color: '#3B82F6' },
        { text: ' tools', color: '#ffffff' },
      ]);
    }
  });

  it('applies new defaults for header alignment and connection/flow opacity', () => {
    const spec = parseDesignSpec({
      header: { title: 'Defaults' },
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
        { type: 'connection', from: 'a', to: 'b' },
      ],
    });

    expect(spec.header?.align).toBe('center');
    expect(spec.header?.titleLetterSpacing).toBe(0);

    const flow = spec.elements.find(
      (element) => element.type === 'flow-node' && element.id === 'a',
    );
    const connection = spec.elements.find((element) => element.type === 'connection');

    if (flow?.type === 'flow-node') {
      expect(flow.opacity).toBe(1);
    }
    if (connection?.type === 'connection') {
      expect(connection.opacity).toBe(1);
    }
  });

  it('supports style overrides for code-block and terminal elements', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'code-block',
          id: 'code',
          language: 'ts',
          code: 'const hello = 1;',
          style: {
            paddingHorizontal: 64,
            paddingVertical: 52,
            windowControls: 'bw',
            dropShadow: false,
            scale: 4,
          },
        },
        {
          type: 'terminal',
          id: 'term',
          content: 'echo hello',
          style: {
            surroundColor: 'rgba(10, 20, 30, 1)',
            fontSize: 16,
            lineHeightPercent: 150,
            windowControls: 'none',
            scale: 1,
          },
        },
      ],
    });

    const code = spec.elements.find((element) => element.type === 'code-block');
    const term = spec.elements.find((element) => element.type === 'terminal');

    expect(code?.type).toBe('code-block');
    if (code?.type === 'code-block') {
      expect(code.style?.paddingHorizontal).toBe(64);
      expect(code.style?.dropShadow).toBe(false);
      expect(code.style?.windowControls).toBe('bw');
      expect(code.style?.scale).toBe(4);
    }

    expect(term?.type).toBe('terminal');
    if (term?.type === 'terminal') {
      expect(term.style?.windowControls).toBe('none');
      expect(term.style?.fontSize).toBe(16);
      expect(term.style?.lineHeightPercent).toBe(150);
      expect(term.style?.scale).toBe(1);
    }
  });

  it('rejects invalid connection shape', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'connection',
            from: 'a',
            to: 'b',
            arrow: 'sideways',
          },
        ],
      }),
    ).toThrow();
  });

  describe('radial layout config', () => {
    it('accepts radial-specific options in auto layout config', () => {
      const spec = parseDesignSpec({
        layout: {
          mode: 'auto',
          algorithm: 'radial',
          direction: 'TB',
          nodeSpacing: 80,
          rankSpacing: 120,
          edgeRouting: 'polyline',
          radialRoot: 'center-node',
          radialRadius: 200,
          radialCompaction: 'wedge',
          radialSortBy: 'connections',
        },
        elements: [
          { type: 'flow-node', id: 'center-node', shape: 'circle', label: 'Center' },
          { type: 'flow-node', id: 'outer-1', shape: 'box', label: 'Outer 1' },
          { type: 'connection', from: 'center-node', to: 'outer-1' },
        ],
      });

      expect(spec.layout.mode).toBe('auto');
      if (spec.layout.mode === 'auto') {
        expect(spec.layout.algorithm).toBe('radial');
        expect(spec.layout.radialRoot).toBe('center-node');
        expect(spec.layout.radialRadius).toBe(200);
        expect(spec.layout.radialCompaction).toBe('wedge');
        expect(spec.layout.radialSortBy).toBe('connections');
      }
    });

    it('accepts radial options with all compaction variants', () => {
      for (const compaction of ['none', 'radial', 'wedge'] as const) {
        const spec = parseDesignSpec({
          layout: {
            mode: 'auto',
            algorithm: 'radial',
            radialCompaction: compaction,
          },
          elements: [
            { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
            { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
            { type: 'connection', from: 'a', to: 'b' },
          ],
        });

        if (spec.layout.mode === 'auto') {
          expect(spec.layout.radialCompaction).toBe(compaction);
        }
      }
    });

    it('accepts radial options with all sortBy variants', () => {
      for (const sortBy of ['id', 'connections'] as const) {
        const spec = parseDesignSpec({
          layout: {
            mode: 'auto',
            algorithm: 'radial',
            radialSortBy: sortBy,
          },
          elements: [
            { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
            { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
            { type: 'connection', from: 'a', to: 'b' },
          ],
        });

        if (spec.layout.mode === 'auto') {
          expect(spec.layout.radialSortBy).toBe(sortBy);
        }
      }
    });

    it('radial options are optional and default to undefined', () => {
      const spec = parseDesignSpec({
        layout: {
          mode: 'auto',
          algorithm: 'radial',
        },
        elements: [
          { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
          { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
          { type: 'connection', from: 'a', to: 'b' },
        ],
      });

      if (spec.layout.mode === 'auto') {
        expect(spec.layout.radialRoot).toBeUndefined();
        expect(spec.layout.radialRadius).toBeUndefined();
        expect(spec.layout.radialCompaction).toBeUndefined();
        expect(spec.layout.radialSortBy).toBeUndefined();
      }
    });

    it('backward compat: non-radial algorithms ignore radial options', () => {
      const spec = parseDesignSpec({
        layout: {
          mode: 'auto',
          algorithm: 'layered',
        },
        elements: [
          { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
          { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
          { type: 'connection', from: 'a', to: 'b' },
        ],
      });

      if (spec.layout.mode === 'auto') {
        expect(spec.layout.algorithm).toBe('layered');
        expect(spec.layout.radialRoot).toBeUndefined();
        expect(spec.layout.radialRadius).toBeUndefined();
        expect(spec.layout.radialCompaction).toBeUndefined();
        expect(spec.layout.radialSortBy).toBeUndefined();
      }
    });

    it('rejects invalid radialCompaction value', () => {
      expect(() =>
        parseDesignSpec({
          layout: {
            mode: 'auto',
            algorithm: 'radial',
            radialCompaction: 'invalid',
          },
          elements: [{ type: 'flow-node', id: 'a', shape: 'box', label: 'A' }],
        }),
      ).toThrow();
    });

    it('rejects invalid radialSortBy value', () => {
      expect(() =>
        parseDesignSpec({
          layout: {
            mode: 'auto',
            algorithm: 'radial',
            radialSortBy: 'invalid',
          },
          elements: [{ type: 'flow-node', id: 'a', shape: 'box', label: 'A' }],
        }),
      ).toThrow();
    });

    it('rejects non-positive radialRadius', () => {
      expect(() =>
        parseDesignSpec({
          layout: {
            mode: 'auto',
            algorithm: 'radial',
            radialRadius: 0,
          },
          elements: [{ type: 'flow-node', id: 'a', shape: 'box', label: 'A' }],
        }),
      ).toThrow();

      expect(() =>
        parseDesignSpec({
          layout: {
            mode: 'auto',
            algorithm: 'radial',
            radialRadius: -10,
          },
          elements: [{ type: 'flow-node', id: 'a', shape: 'box', label: 'A' }],
        }),
      ).toThrow();
    });
  });
});
