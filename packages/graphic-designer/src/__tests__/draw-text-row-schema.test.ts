import { describe, expect, it } from 'vitest';
import { type DrawTextRow, type DrawTextRowSegment, designSpecSchema } from '../spec.schema.js';

function parseDrawCommand(cmd: unknown) {
  return designSpecSchema.parse({
    version: 2,
    draw: [cmd],
  });
}

function expectSuccess(cmd: unknown) {
  const result = parseDrawCommand(cmd);
  return result.draw[0];
}

function expectFailure(cmd: unknown) {
  expect(() => parseDrawCommand(cmd)).toThrow();
}

describe('drawTextRowSchema', () => {
  const minimal: Record<string, unknown> = {
    type: 'text-row',
    segments: [{ text: 'hello' }],
    x: 100,
    y: 200,
  };

  it('accepts a minimal text-row command with defaults', () => {
    const result = expectSuccess(minimal) as DrawTextRow;
    expect(result.type).toBe('text-row');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('hello');
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    // defaults
    expect(result.align).toBe('center');
    expect(result.baseline).toBe('alphabetic');
    expect(result.defaultFontSize).toBe(16);
    expect(result.defaultFontWeight).toBe(400);
    expect(result.defaultFontFamily).toBe('body');
    expect(result.defaultColor).toBe('#FFFFFF');
    expect(result.opacity).toBe(1);
  });

  it('accepts multiple segments', () => {
    const result = expectSuccess({
      ...minimal,
      segments: [{ text: 'hello' }, { text: ' world' }, { text: '!' }],
    }) as DrawTextRow;
    expect(result.segments).toHaveLength(3);
  });

  it('accepts per-segment overrides', () => {
    const result = expectSuccess({
      ...minimal,
      segments: [
        {
          text: 'bold red',
          color: '#FF0000',
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'heading',
        },
        { text: ' normal' },
      ],
    }) as DrawTextRow;
    const seg = result.segments[0] as DrawTextRowSegment;
    expect(seg.color).toBe('#FF0000');
    expect(seg.fontSize).toBe(24);
    expect(seg.fontWeight).toBe(700);
    expect(seg.fontFamily).toBe('heading');
    // second segment has no overrides
    expect(result.segments[1].color).toBeUndefined();
    expect(result.segments[1].fontSize).toBeUndefined();
  });

  it('accepts all custom top-level values', () => {
    const result = expectSuccess({
      type: 'text-row',
      segments: [{ text: 'test' }],
      x: 50,
      y: 75,
      align: 'left',
      baseline: 'top',
      defaultFontSize: 32,
      defaultFontWeight: 700,
      defaultFontFamily: 'mono',
      defaultColor: '#00FF00',
      opacity: 0.5,
    }) as DrawTextRow;
    expect(result.align).toBe('left');
    expect(result.baseline).toBe('top');
    expect(result.defaultFontSize).toBe(32);
    expect(result.defaultFontWeight).toBe(700);
    expect(result.defaultFontFamily).toBe('mono');
    expect(result.defaultColor).toBe('#00FF00');
    expect(result.opacity).toBe(0.5);
  });

  it('accepts rgb() and rgba() colors', () => {
    const result = expectSuccess({
      ...minimal,
      segments: [{ text: 'test', color: 'rgb(255, 0, 0)' }],
      defaultColor: 'rgba(0, 255, 0, 0.8)',
    }) as DrawTextRow;
    // Colors should be normalised to hex
    expect(result.segments[0].color).toMatch(/^#[0-9A-F]{6,8}$/i);
    expect(result.defaultColor).toMatch(/^#[0-9A-F]{6,8}$/i);
  });

  describe('strict mode', () => {
    it('rejects unknown properties on top-level', () => {
      expectFailure({ ...minimal, unknownProp: true });
    });

    it('rejects unknown properties on segments', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'hi', bogus: 42 }],
      });
    });
  });

  describe('validation', () => {
    it('rejects empty segments array', () => {
      expectFailure({ ...minimal, segments: [] });
    });

    it('rejects more than 20 segments', () => {
      const segments = Array.from({ length: 21 }, (_, i) => ({ text: `seg${i}` }));
      expectFailure({ ...minimal, segments });
    });

    it('rejects segment with empty text', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: '' }],
      });
    });

    it('rejects segment text exceeding 500 chars', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'x'.repeat(501) }],
      });
    });

    it('rejects fontSize below 6', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', fontSize: 5 }],
      });
    });

    it('rejects fontSize above 200', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', fontSize: 201 }],
      });
    });

    it('rejects fontWeight below 100', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', fontWeight: 99 }],
      });
    });

    it('rejects fontWeight above 900', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', fontWeight: 901 }],
      });
    });

    it('rejects non-integer fontWeight', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', fontWeight: 400.5 }],
      });
    });

    it('rejects invalid fontFamily', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', fontFamily: 'comic-sans' }],
      });
    });

    it('rejects invalid color hex', () => {
      expectFailure({
        ...minimal,
        segments: [{ text: 'test', color: 'not-a-color' }],
      });
    });

    it('rejects defaultFontSize below 6', () => {
      expectFailure({ ...minimal, defaultFontSize: 5 });
    });

    it('rejects defaultFontSize above 200', () => {
      expectFailure({ ...minimal, defaultFontSize: 201 });
    });

    it('rejects defaultFontWeight below 100', () => {
      expectFailure({ ...minimal, defaultFontWeight: 99 });
    });

    it('rejects defaultFontWeight above 900', () => {
      expectFailure({ ...minimal, defaultFontWeight: 901 });
    });

    it('rejects non-integer defaultFontWeight', () => {
      expectFailure({ ...minimal, defaultFontWeight: 400.5 });
    });

    it('rejects opacity below 0', () => {
      expectFailure({ ...minimal, opacity: -0.1 });
    });

    it('rejects opacity above 1', () => {
      expectFailure({ ...minimal, opacity: 1.1 });
    });

    it('rejects invalid align value', () => {
      expectFailure({ ...minimal, align: 'justify' });
    });

    it('rejects invalid baseline value', () => {
      expectFailure({ ...minimal, baseline: 'hanging' });
    });

    it('rejects missing x', () => {
      const { x: _, ...noX } = minimal;
      expectFailure(noX);
    });

    it('rejects missing y', () => {
      const { y: _, ...noY } = minimal;
      expectFailure(noY);
    });
  });

  describe('discriminated union registration', () => {
    it('coexists with other draw commands in the same spec', () => {
      const result = designSpecSchema.parse({
        version: 2,
        draw: [
          { type: 'rect', x: 0, y: 0, width: 100, height: 50 },
          { type: 'text-row', segments: [{ text: 'hello' }], x: 10, y: 10 },
          { type: 'text', x: 0, y: 0, text: 'plain' },
        ],
      });
      expect(result.draw).toHaveLength(3);
      expect(result.draw[0].type).toBe('rect');
      expect(result.draw[1].type).toBe('text-row');
      expect(result.draw[2].type).toBe('text');
    });
  });

  describe('type exports', () => {
    it('DrawTextRow type is usable', () => {
      const row: DrawTextRow = {
        type: 'text-row',
        segments: [{ text: 'typed' }],
        x: 0,
        y: 0,
        align: 'center',
        baseline: 'alphabetic',
        defaultFontSize: 16,
        defaultFontWeight: 400,
        defaultFontFamily: 'body',
        defaultColor: '#FFFFFF',
        opacity: 1,
      };
      expect(row.type).toBe('text-row');
    });

    it('DrawTextRowSegment type is usable', () => {
      const seg: DrawTextRowSegment = {
        text: 'typed',
        color: '#FF0000',
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'heading',
      };
      expect(seg.text).toBe('typed');
    });
  });
});
