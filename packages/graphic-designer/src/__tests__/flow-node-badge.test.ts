import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { BADGE_INSIDE_TOP_EXTRA, renderFlowNode } from '../renderers/flow-node.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

const theme = resolveTheme('dark');

function makeCanvas() {
  const canvas = createCanvas(1200, 675);
  return canvas.getContext('2d');
}

const bounds = { x: 100, y: 100, width: 200, height: 100 };

describe('flow-node badge schema', () => {
  it('accepts badgeText with default position', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A', badgeText: 'NEW' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type === 'flow-node' && n1.badgeText).toBe('NEW');
    expect(n1?.type === 'flow-node' && n1.badgePosition).toBe('inside-top');
  });

  it('accepts all badge properties', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'rounded-box',
          label: 'A',
          badgeText: 'BETA',
          badgeColor: '#FF0000',
          badgeBackground: '#00FF00',
          badgePosition: 'top',
        },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type).toBe('flow-node');
    if (n1?.type === 'flow-node') {
      expect(n1.badgeText).toBe('BETA');
      expect(n1.badgeColor).toBe('#FF0000');
      expect(n1.badgeBackground).toBe('#00FF00');
      expect(n1.badgePosition).toBe('top');
    }
  });

  it('defaults badgePosition to inside-top', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A', badgeText: 'TAG' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.badgePosition).toBe('inside-top');
    }
  });

  it('rejects empty badgeText', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A', badgeText: '' }],
      }),
    ).toThrow();
  });

  it('rejects badgeText longer than 32 characters', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            badgeText: 'A'.repeat(33),
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects invalid badgePosition', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            badgeText: 'X',
            badgePosition: 'bottom' as 'top',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects invalid badgeColor', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'flow-node',
            id: 'n1',
            shape: 'box',
            label: 'A',
            badgeText: 'X',
            badgeColor: 'not-a-color',
          },
        ],
      }),
    ).toThrow();
  });

  it('allows omitting badgeText (backward compatible)', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'box', label: 'A' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.badgeText).toBeUndefined();
    }
  });
});

describe('flow-node badge rendering', () => {
  it('renders inside-top badge without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Node',
        badgeText: 'NEW',
        badgePosition: 'inside-top',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('renders top badge without throwing', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Node',
        badgeText: 'BETA',
        badgePosition: 'top',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].kind).toBe('flow-node');
  });

  it('renders badge with custom colors', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'box',
        label: 'Colored',
        badgeText: 'HOT',
        badgeColor: '#FF0000',
        badgeBackground: '#00FF00',
        badgePosition: 'inside-top',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders identically without badge (backward compatible)', () => {
    const ctx = makeCanvas();
    const withoutBadge = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Same',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    const withoutBadge2 = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Same',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );

    // Both should produce same metadata (same bounds, same colors)
    expect(withoutBadge[0].bounds).toEqual(withoutBadge2[0].bounds);
    expect(withoutBadge[0].backgroundColor).toBe(withoutBadge2[0].backgroundColor);
    expect(withoutBadge[1].bounds).toEqual(withoutBadge2[1].bounds);
  });

  it('renders badge with sublabel', () => {
    const ctx = makeCanvas();
    const elements = renderFlowNode(
      ctx,
      {
        type: 'flow-node',
        id: 'n1',
        shape: 'rounded-box',
        label: 'Main',
        sublabel: 'subtitle',
        badgeText: 'v2',
        badgePosition: 'inside-top',
        opacity: 1,
        fillOpacity: 1,
      },
      bounds,
      theme,
    );
    expect(elements.length).toBeGreaterThan(0);
  });

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
    it(`renders ${shape} with inside-top badge without throwing`, () => {
      const ctx = makeCanvas();
      const elements = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: `node-${shape}`,
          shape,
          label: shape,
          badgeText: 'TAG',
          badgePosition: 'inside-top',
          opacity: 1,
          fillOpacity: 1,
        },
        bounds,
        theme,
      );
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].kind).toBe('flow-node');
    });

    it(`renders ${shape} with top badge without throwing`, () => {
      const ctx = makeCanvas();
      const elements = renderFlowNode(
        ctx,
        {
          type: 'flow-node',
          id: `node-${shape}`,
          shape,
          label: shape,
          badgeText: 'TAG',
          badgePosition: 'top',
          opacity: 1,
          fillOpacity: 1,
        },
        bounds,
        theme,
      );
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].kind).toBe('flow-node');
    });
  }
});

describe('flow-node badge size estimation', () => {
  it('exports BADGE_INSIDE_TOP_EXTRA constant', () => {
    expect(typeof BADGE_INSIDE_TOP_EXTRA).toBe('number');
    expect(BADGE_INSIDE_TOP_EXTRA).toBeGreaterThan(0);
  });
});
