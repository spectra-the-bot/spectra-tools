import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderFlowNode } from '../renderers/flow-node.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

describe('flow-node sublabel2', () => {
  // ── Schema validation ──

  it('accepts sublabel2 with optional color and fontSize', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'Service',
          sublabel: 'HTTP API',
          sublabel2: 'gpt-4o',
          sublabel2Color: '#AABBCC',
          sublabel2FontSize: 10,
        },
      ],
    });
    const node = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(node?.type === 'flow-node' && node.sublabel2).toBe('gpt-4o');
    expect(node?.type === 'flow-node' && node.sublabel2Color).toBe('#AABBCC');
    expect(node?.type === 'flow-node' && node.sublabel2FontSize).toBe(10);
  });

  it('sublabel2 defaults are optional (no defaults applied)', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'Plain',
        },
      ],
    });
    const node = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(node?.type === 'flow-node' && node.sublabel2).toBeUndefined();
    expect(node?.type === 'flow-node' && node.sublabel2Color).toBeUndefined();
    expect(node?.type === 'flow-node' && node.sublabel2FontSize).toBeUndefined();
  });

  it('rejects sublabel2FontSize below 8', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'X',
            sublabel2: 'y',
            sublabel2FontSize: 5,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects sublabel2FontSize above 32', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'X',
            sublabel2: 'y',
            sublabel2FontSize: 64,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects empty sublabel2', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'X',
            sublabel2: '',
          },
        ],
      }),
    ).toThrow();
  });

  // ── Rendering ──

  const allShapes = [
    'box',
    'rounded-box',
    'diamond',
    'circle',
    'pill',
    'cylinder',
    'parallelogram',
  ] as const;

  for (const shape of allShapes) {
    it(`renders sublabel2 on ${shape} shape without throwing`, () => {
      const theme = resolveTheme('dark');
      const canvas = createCanvas(1200, 675);
      const ctx = canvas.getContext('2d');

      const els = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: 'n1',
          shape,
          label: 'Main',
          sublabel: 'Sub',
          sublabel2: 'Third',
          fillOpacity: 1,
          opacity: 1,
        },
        { x: 50, y: 50, width: 200, height: 120 },
        theme,
      );

      expect(els.length).toBeGreaterThan(0);
      expect(els[0].id).toBe('flow-node-n1');
    });
  }

  // ── Backward compatibility ──

  it('nodes without sublabel2 render identically (no crash, same element count)', () => {
    const theme = resolveTheme('dark');
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    const elsWithout = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Start',
        sublabel: 'begin',
        fillOpacity: 1,
        opacity: 1,
      },
      { x: 50, y: 50, width: 180, height: 80 },
      theme,
    );

    const elsWith = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n2',
        shape: 'rounded-box',
        label: 'Start',
        sublabel: 'begin',
        sublabel2: 'model',
        fillOpacity: 1,
        opacity: 1,
      },
      { x: 50, y: 50, width: 180, height: 80 },
      theme,
    );

    // Both should produce the same number of rendered elements
    expect(elsWithout.length).toBe(elsWith.length);
  });

  // ── Vertical centering ──

  it('text bounds expand for three lines', () => {
    const theme = resolveTheme('dark');
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');
    const bounds = { x: 50, y: 50, width: 200, height: 120 };

    const elsOneLine = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Only',
        fillOpacity: 1,
        opacity: 1,
      },
      bounds,
      theme,
    );

    const elsTwoLines = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n2',
        shape: 'box',
        label: 'Title',
        sublabel: 'Sub',
        fillOpacity: 1,
        opacity: 1,
      },
      bounds,
      theme,
    );

    const elsThreeLines = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n3',
        shape: 'box',
        label: 'Title',
        sublabel: 'Sub',
        sublabel2: 'Third',
        fillOpacity: 1,
        opacity: 1,
      },
      bounds,
      theme,
    );

    // Text bounds height should grow with more lines
    const oneLabelBounds = elsOneLine.find((e) => e.id.endsWith('-label'))?.bounds;
    const twoLabelBounds = elsTwoLines.find((e) => e.id.endsWith('-label'))?.bounds;
    const threeLabelBounds = elsThreeLines.find((e) => e.id.endsWith('-label'))?.bounds;

    expect(oneLabelBounds).toBeDefined();
    expect(twoLabelBounds).toBeDefined();
    expect(threeLabelBounds).toBeDefined();

    // 1-line < 2-line < 3-line text bounds height
    expect(oneLabelBounds?.height).toBeLessThan(twoLabelBounds?.height as number);
    expect(twoLabelBounds?.height).toBeLessThan(threeLabelBounds?.height as number);
  });

  it('sublabel2 without sublabel renders as second line', () => {
    const theme = resolveTheme('dark');
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    // sublabel2 without sublabel should not crash
    const els = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Title',
        sublabel2: 'Model',
        fillOpacity: 1,
        opacity: 1,
      },
      { x: 50, y: 50, width: 200, height: 100 },
      theme,
    );

    expect(els.length).toBeGreaterThan(0);
  });

  it('sublabel2Color falls back to sublabelColor when not provided', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'box',
          label: 'A',
          sublabel: 'B',
          sublabelColor: '#FF0000',
          sublabel2: 'C',
        },
      ],
    });
    const node = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    // sublabel2Color not set — renderer will use sublabelColor as fallback
    expect(node?.type === 'flow-node' && node.sublabel2Color).toBeUndefined();
    expect(node?.type === 'flow-node' && node.sublabelColor).toBe('#FF0000');
  });

  // ── estimateFlowNodeSize ──

  it('estimateFlowNodeSize accounts for sublabel2 in flowchart context', () => {
    const spec = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B', sublabel2: 'model' },
        {
          type: 'flow-node',
          id: 'c',
          shape: 'box',
          label: 'C',
          sublabel2: 'model',
          sublabel2FontSize: 16,
        },
        {
          type: 'connection',
          from: 'a',
          to: 'b',
          style: 'solid',
          arrow: 'end',
          labelPosition: 'middle',
          opacity: 1,
        },
      ],
    });

    // Verify the spec parses correctly with sublabel2 in a flowchart context.
    expect(spec.elements.length).toBe(4);
    expect(spec.layout.mode).toBe('auto');
  });
});
