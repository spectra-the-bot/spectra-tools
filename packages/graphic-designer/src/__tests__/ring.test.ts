import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderRingElement } from '../renderers/ring.js';
import { parseDesignSpec } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

describe('ring element schema', () => {
  it('parses minimal ring element with defaults', () => {
    const spec = parseDesignSpec({
      version: 2,
      elements: [{ type: 'ring', id: 'r1' }],
    });

    const ring = spec.elements.find((el) => el.type === 'ring');
    expect(ring).toBeDefined();
    expect(ring?.type).toBe('ring');
    expect(ring?.radius).toBe(48);
    expect(ring?.strokeWidth).toBe(2);
    expect(ring?.segments).toHaveLength(1);
    expect(ring?.glowRadius).toBe(0);
    expect(ring?.showCycleArrows).toBe(false);
    expect(ring?.fillOpacity).toBe(0.05);
    expect(ring?.labelSize).toBe(12);
  });

  it('parses ring element with all properties', () => {
    const spec = parseDesignSpec({
      version: 2,
      elements: [
        {
          type: 'ring',
          id: 'r2',
          radius: 100,
          strokeWidth: 4,
          label: 'Cycle\\nPhase',
          labelColor: '#FFFFFF',
          labelSize: 16,
          segments: [{ color: '#FF0000' }, { color: '#00FF00' }, { color: '#0000FF' }],
          glowRadius: 12,
          glowColor: '#FF00FF',
          showCycleArrows: true,
          fill: '#112233',
          fillOpacity: 0.1,
        },
      ],
    });

    const ring = spec.elements.find((el) => el.type === 'ring');
    expect(ring).toBeDefined();
    expect(ring?.radius).toBe(100);
    expect(ring?.strokeWidth).toBe(4);
    expect(ring?.segments).toHaveLength(3);
    expect(ring?.glowRadius).toBe(12);
    expect(ring?.showCycleArrows).toBe(true);
    expect(ring?.fillOpacity).toBe(0.1);
  });

  it('rejects ring with zero segments', () => {
    expect(() =>
      parseDesignSpec({
        version: 2,
        elements: [{ type: 'ring', id: 'r3', segments: [] }],
      }),
    ).toThrow();
  });

  it('rejects ring with too many segments', () => {
    const tooMany = Array.from({ length: 25 }, () => ({ color: '#AABBCC' }));
    expect(() =>
      parseDesignSpec({
        version: 2,
        elements: [{ type: 'ring', id: 'r4', segments: tooMany }],
      }),
    ).toThrow();
  });

  it('rejects ring with radius out of range', () => {
    expect(() =>
      parseDesignSpec({
        version: 2,
        elements: [{ type: 'ring', id: 'r5', radius: 5 }],
      }),
    ).toThrow();

    expect(() =>
      parseDesignSpec({
        version: 2,
        elements: [{ type: 'ring', id: 'r6', radius: 600 }],
      }),
    ).toThrow();
  });

  it('rejects extra properties (strict)', () => {
    expect(() =>
      parseDesignSpec({
        version: 2,
        elements: [{ type: 'ring', id: 'r7', unknown: true }],
      }),
    ).toThrow();
  });

  it('coexists with other element types', () => {
    const spec = parseDesignSpec({
      version: 2,
      elements: [
        { type: 'ring', id: 'r1' },
        { type: 'card', id: 'c1', title: 'Card', body: 'Body' },
        { type: 'text', id: 't1', content: 'Hello', style: 'body' },
      ],
    });

    expect(spec.elements).toHaveLength(3);
    expect(spec.elements.map((el) => el.type)).toContain('ring');
  });
});

describe('ring element renderer', () => {
  const theme = resolveTheme('dark');

  function makeCtx() {
    const canvas = createCanvas(800, 600);
    return canvas.getContext('2d');
  }

  it('renders default ring and returns metadata', () => {
    const ctx = makeCtx();
    const bounds = { x: 100, y: 100, width: 112, height: 112 };
    const result = renderRingElement(
      ctx,
      {
        type: 'ring',
        id: 'r1',
        radius: 48,
        strokeWidth: 2,
        labelSize: 12,
        segments: [{ color: '#4A7BF7' }],
        glowRadius: 0,
        showCycleArrows: false,
        fillOpacity: 0.05,
      },
      bounds,
      theme,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ring-r1');
    expect(result[0].kind).toBe('shape');
    expect(result[0].bounds).toEqual(bounds);
  });

  it('renders ring with glow', () => {
    const ctx = makeCtx();
    const bounds = { x: 50, y: 50, width: 140, height: 140 };
    const result = renderRingElement(
      ctx,
      {
        type: 'ring',
        id: 'r2',
        radius: 48,
        strokeWidth: 3,
        labelSize: 12,
        segments: [{ color: '#FF5500' }],
        glowRadius: 16,
        glowColor: '#FF5500',
        showCycleArrows: false,
        fillOpacity: 0.05,
      },
      bounds,
      theme,
    );

    expect(result).toHaveLength(1);
    expect(result[0].foregroundColor).toBe('#FF5500');
  });

  it('renders ring with multiple segments', () => {
    const ctx = makeCtx();
    const bounds = { x: 50, y: 50, width: 120, height: 120 };
    const result = renderRingElement(
      ctx,
      {
        type: 'ring',
        id: 'r3',
        radius: 52,
        strokeWidth: 4,
        labelSize: 12,
        segments: [{ color: '#FF0000' }, { color: '#00FF00' }, { color: '#0000FF' }],
        glowRadius: 0,
        showCycleArrows: false,
        fillOpacity: 0,
      },
      bounds,
      theme,
    );

    expect(result).toHaveLength(1);
  });

  it('renders ring with cycle arrows', () => {
    const ctx = makeCtx();
    const bounds = { x: 50, y: 50, width: 120, height: 120 };
    const result = renderRingElement(
      ctx,
      {
        type: 'ring',
        id: 'r4',
        radius: 48,
        strokeWidth: 2,
        labelSize: 12,
        segments: [{ color: '#AABB00' }, { color: '#00AABB' }],
        glowRadius: 0,
        showCycleArrows: true,
        fillOpacity: 0.05,
      },
      bounds,
      theme,
    );

    expect(result).toHaveLength(1);
  });

  it('renders ring with label', () => {
    const ctx = makeCtx();
    const bounds = { x: 50, y: 50, width: 120, height: 120 };
    const result = renderRingElement(
      ctx,
      {
        type: 'ring',
        id: 'r5',
        radius: 48,
        strokeWidth: 2,
        label: 'Phase\\n1',
        labelColor: '#FFFFFF',
        labelSize: 14,
        segments: [{ color: '#4A7BF7' }],
        glowRadius: 0,
        showCycleArrows: false,
        fillOpacity: 0.05,
      },
      bounds,
      theme,
    );

    expect(result).toHaveLength(1);
  });

  it('renders ring with fill', () => {
    const ctx = makeCtx();
    const bounds = { x: 50, y: 50, width: 120, height: 120 };
    const result = renderRingElement(
      ctx,
      {
        type: 'ring',
        id: 'r6',
        radius: 48,
        strokeWidth: 2,
        labelSize: 12,
        segments: [{ color: '#4A7BF7' }],
        glowRadius: 0,
        showCycleArrows: false,
        fill: '#223344',
        fillOpacity: 0.2,
      },
      bounds,
      theme,
    );

    expect(result).toHaveLength(1);
  });
});
