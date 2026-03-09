import { describe, expect, it } from 'vitest';
import { parseDesignSpec } from '../spec.schema.js';
import { isHexColor, isRgbaColor, normalizeColor, parseRgbaToHex } from '../utils/color.js';

describe('parseRgbaToHex', () => {
  it('converts rgba with fractional alpha', () => {
    expect(parseRgbaToHex('rgba(124,58,237,0.15)')).toBe('#7c3aed26');
  });

  it('converts rgba with alpha 1', () => {
    expect(parseRgbaToHex('rgba(255,0,0,1)')).toBe('#ff0000ff');
  });

  it('converts rgba with alpha 0', () => {
    expect(parseRgbaToHex('rgba(0,0,0,0)')).toBe('#00000000');
  });

  it('converts rgb without alpha', () => {
    expect(parseRgbaToHex('rgb(255,255,255)')).toBe('#ffffff');
  });

  it('converts rgb with zero values', () => {
    expect(parseRgbaToHex('rgb(0,0,0)')).toBe('#000000');
  });

  it('converts rgba with max channel values', () => {
    expect(parseRgbaToHex('rgba(255,255,255,1)')).toBe('#ffffffff');
  });

  it('handles whitespace around values', () => {
    expect(parseRgbaToHex('rgba( 124 , 58 , 237 , 0.15 )')).toBe('#7c3aed26');
  });

  it('handles rgb with whitespace', () => {
    expect(parseRgbaToHex('rgb( 10 , 20 , 30 )')).toBe('#0a141e');
  });

  it('converts rgba with alpha 0.5', () => {
    expect(parseRgbaToHex('rgba(128,128,128,0.5)')).toBe('#80808080');
  });

  it('converts rgba with shorthand alpha .5', () => {
    expect(parseRgbaToHex('rgba(128,128,128,.5)')).toBe('#80808080');
  });

  it('throws on invalid format', () => {
    expect(() => parseRgbaToHex('not-a-color')).toThrow('Invalid rgb/rgba color');
  });

  it('throws on channel values above 255', () => {
    expect(() => parseRgbaToHex('rgb(256,0,0)')).toThrow('RGB channel values must be 0-255');
  });
});

describe('isRgbaColor', () => {
  it('returns true for rgba()', () => {
    expect(isRgbaColor('rgba(124,58,237,0.15)')).toBe(true);
  });

  it('returns true for rgb()', () => {
    expect(isRgbaColor('rgb(0,0,0)')).toBe(true);
  });

  it('returns false for hex', () => {
    expect(isRgbaColor('#ff0000')).toBe(false);
  });

  it('returns false for garbage', () => {
    expect(isRgbaColor('banana')).toBe(false);
  });
});

describe('isHexColor', () => {
  it('returns true for #RRGGBB', () => {
    expect(isHexColor('#ff0000')).toBe(true);
  });

  it('returns true for #RRGGBBAA', () => {
    expect(isHexColor('#ff000080')).toBe(true);
  });

  it('returns false for rgb()', () => {
    expect(isHexColor('rgb(0,0,0)')).toBe(false);
  });
});

describe('normalizeColor', () => {
  it('passes hex through unchanged', () => {
    expect(normalizeColor('#aabbcc')).toBe('#aabbcc');
  });

  it('converts rgba to hex', () => {
    expect(normalizeColor('rgba(124,58,237,0.15)')).toBe('#7c3aed26');
  });

  it('converts rgb to hex', () => {
    expect(normalizeColor('rgb(255,128,0)')).toBe('#ff8000');
  });

  it('throws on invalid input', () => {
    expect(() => normalizeColor('not-a-color')).toThrow();
  });
});

describe('rgba/rgb in design spec schema', () => {
  it('accepts rgba() in flow-node color fields', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'flow-node',
          id: 'n1',
          shape: 'rounded-box',
          label: 'Node',
          color: 'rgba(124,58,237,0.15)',
          borderColor: 'rgb(255,0,0)',
        },
      ],
    });

    const node = spec.elements[0];
    if (node.type === 'flow-node') {
      expect(node.color).toBe('#7c3aed26');
      expect(node.borderColor).toBe('#ff0000');
    }
  });

  it('accepts rgba() in shape fill and stroke', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'shape',
          id: 's1',
          shape: 'rectangle',
          fill: 'rgba(0,0,0,0.5)',
          stroke: 'rgb(128,128,128)',
        },
      ],
    });

    const shape = spec.elements[0];
    if (shape.type === 'shape') {
      expect(shape.fill).toBe('#00000080');
      expect(shape.stroke).toBe('#808080');
    }
  });

  it('accepts rgba() in draw commands', () => {
    const spec = parseDesignSpec({
      draw: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          fill: 'rgba(255,255,255,0.8)',
        },
      ],
    });

    expect(spec.draw[0].type).toBe('rect');
    if (spec.draw[0].type === 'rect') {
      expect(spec.draw[0].fill).toBe('#ffffffcc');
    }
  });

  it('accepts rgba() in connection color', () => {
    const spec = parseDesignSpec({
      elements: [
        { type: 'flow-node', id: 'a', shape: 'box', label: 'A' },
        { type: 'flow-node', id: 'b', shape: 'box', label: 'B' },
        {
          type: 'connection',
          from: 'a',
          to: 'b',
          color: 'rgba(100,200,50,0.7)',
        },
      ],
    });

    const conn = spec.elements.find((e) => e.type === 'connection');
    if (conn?.type === 'connection') {
      expect(conn.color).toBe('#64c832b3');
    }
  });

  it('accepts rgba() in text element color', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'text',
          id: 't1',
          content: 'Hello',
          style: 'heading',
          color: 'rgba(255,255,255,0.9)',
        },
      ],
    });

    const text = spec.elements[0];
    if (text.type === 'text') {
      expect(text.color).toBe('#ffffffe6');
    }
  });

  it('accepts rgba() in background color', () => {
    const spec = parseDesignSpec({
      background: 'rgba(10,20,30,1)',
      elements: [],
    });

    expect(spec.background).toBe('#0a141eff');
  });

  it('accepts rgba() in gradient stop colors', () => {
    const spec = parseDesignSpec({
      background: {
        type: 'linear',
        stops: [
          { offset: 0, color: 'rgba(0,0,0,1)' },
          { offset: 1, color: 'rgba(255,255,255,1)' },
        ],
      },
      elements: [],
    });

    if (typeof spec.background === 'object' && spec.background.type === 'linear') {
      expect(spec.background.stops[0].color).toBe('#000000ff');
      expect(spec.background.stops[1].color).toBe('#ffffffff');
    }
  });

  it('still accepts hex colors as before', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          type: 'shape',
          id: 's1',
          shape: 'circle',
          fill: '#112233',
          stroke: '#44556677',
        },
      ],
    });

    const shape = spec.elements[0];
    if (shape.type === 'shape') {
      expect(shape.fill).toBe('#112233');
      expect(shape.stroke).toBe('#44556677');
    }
  });

  it('rejects invalid color formats', () => {
    expect(() =>
      parseDesignSpec({
        elements: [
          {
            type: 'shape',
            id: 's1',
            shape: 'rectangle',
            fill: 'not-a-color',
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts rgba() in decorator colors', () => {
    const spec = parseDesignSpec({
      elements: [],
      decorators: [
        {
          type: 'vignette',
          color: 'rgba(0,0,0,0.5)',
        },
      ],
    });

    const vignette = spec.decorators[0];
    if (vignette.type === 'vignette') {
      expect(vignette.color).toBe('#00000080');
    }
  });

  it('accepts rgba() in rainbow-rule decorator colors array', () => {
    const spec = parseDesignSpec({
      elements: [],
      decorators: [
        {
          type: 'rainbow-rule',
          colors: ['rgba(255,0,0,1)', 'rgba(0,255,0,1)', 'rgba(0,0,255,1)'],
        },
      ],
    });

    const rainbow = spec.decorators[0];
    if (rainbow.type === 'rainbow-rule') {
      expect(rainbow.colors?.[0]).toBe('#ff0000ff');
      expect(rainbow.colors?.[1]).toBe('#00ff00ff');
      expect(rainbow.colors?.[2]).toBe('#0000ffff');
    }
  });

  it('accepts rgba() in draw badge colors', () => {
    const spec = parseDesignSpec({
      draw: [
        {
          type: 'badge',
          x: 10,
          y: 10,
          text: 'Test',
          color: 'rgb(255,255,255)',
          background: 'rgba(51,75,131,0.8)',
        },
      ],
    });

    const badge = spec.draw[0];
    if (badge.type === 'badge') {
      expect(badge.color).toBe('#ffffff');
      expect(badge.background).toBe('#334b83cc');
    }
  });
});
