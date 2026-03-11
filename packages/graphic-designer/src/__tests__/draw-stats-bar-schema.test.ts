import { describe, expect, it } from 'vitest';
import { type DrawStatsBar, type DrawStatsBarItem, designSpecSchema } from '../spec.schema.js';

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

describe('drawStatsBarSchema', () => {
  const minimal: Record<string, unknown> = {
    type: 'stats-bar',
    y: 600,
    items: [{ value: '150+', label: 'commits' }],
  };

  it('accepts a minimal stats-bar command with defaults', () => {
    const result = expectSuccess(minimal) as DrawStatsBar;
    expect(result.type).toBe('stats-bar');
    expect(result.y).toBe(600);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].value).toBe('150+');
    expect(result.items[0].label).toBe('commits');
    // defaults
    expect(result.separator).toBe('dot');
    expect(result.valueColor).toBe('#FFFFFF');
    expect(result.valueFontSize).toBe(18);
    expect(result.valueFontWeight).toBe(700);
    expect(result.valueFontFamily).toBe('mono');
    expect(result.labelColor).toBe('#AAAAAA');
    expect(result.labelFontSize).toBe(14);
    expect(result.labelFontWeight).toBe(400);
    expect(result.labelFontFamily).toBe('body');
    expect(result.separatorColor).toBe('#666666');
    expect(result.gap).toBe(24);
    expect(result.opacity).toBe(1);
  });

  it('accepts multiple items', () => {
    const result = expectSuccess({
      ...minimal,
      items: [
        { value: '150+', label: 'commits' },
        { value: '50+', label: 'PRs merged' },
        { value: '12', label: 'contributors' },
        { value: '99%', label: 'uptime' },
      ],
    }) as DrawStatsBar;
    expect(result.items).toHaveLength(4);
  });

  it('accepts all custom values', () => {
    const result = expectSuccess({
      type: 'stats-bar',
      y: 500,
      items: [{ value: '42', label: 'answers' }],
      separator: 'pipe',
      valueColor: '#00FF00',
      valueFontSize: 24,
      valueFontWeight: 900,
      valueFontFamily: 'heading',
      labelColor: '#FF0000',
      labelFontSize: 20,
      labelFontWeight: 600,
      labelFontFamily: 'mono',
      separatorColor: '#0000FF',
      gap: 48,
      opacity: 0.8,
    }) as DrawStatsBar;
    expect(result.separator).toBe('pipe');
    expect(result.valueColor).toBe('#00FF00');
    expect(result.valueFontSize).toBe(24);
    expect(result.valueFontWeight).toBe(900);
    expect(result.valueFontFamily).toBe('heading');
    expect(result.labelColor).toBe('#FF0000');
    expect(result.labelFontSize).toBe(20);
    expect(result.labelFontWeight).toBe(600);
    expect(result.labelFontFamily).toBe('mono');
    expect(result.separatorColor).toBe('#0000FF');
    expect(result.gap).toBe(48);
    expect(result.opacity).toBe(0.8);
  });

  it('accepts separator none', () => {
    const result = expectSuccess({
      ...minimal,
      separator: 'none',
    }) as DrawStatsBar;
    expect(result.separator).toBe('none');
  });

  it('accepts rgb() and rgba() colors', () => {
    const result = expectSuccess({
      ...minimal,
      valueColor: 'rgb(255, 0, 0)',
      labelColor: 'rgba(0, 255, 0, 0.8)',
      separatorColor: 'rgb(0, 0, 255)',
    }) as DrawStatsBar;
    expect(result.valueColor).toMatch(/^#[0-9A-F]{6,8}$/i);
    expect(result.labelColor).toMatch(/^#[0-9A-F]{6,8}$/i);
    expect(result.separatorColor).toMatch(/^#[0-9A-F]{6,8}$/i);
  });

  describe('strict mode', () => {
    it('rejects unknown properties on top-level', () => {
      expectFailure({ ...minimal, unknownProp: true });
    });

    it('rejects unknown properties on items', () => {
      expectFailure({
        ...minimal,
        items: [{ value: '1', label: 'test', extra: 'nope' }],
      });
    });
  });

  describe('validation', () => {
    it('rejects empty items array', () => {
      expectFailure({ ...minimal, items: [] });
    });

    it('rejects more than 8 items', () => {
      const items = Array.from({ length: 9 }, (_, i) => ({
        value: `${i}`,
        label: `item${i}`,
      }));
      expectFailure({ ...minimal, items });
    });

    it('accepts exactly 8 items', () => {
      const items = Array.from({ length: 8 }, (_, i) => ({
        value: `${i}`,
        label: `item${i}`,
      }));
      const result = expectSuccess({ ...minimal, items }) as DrawStatsBar;
      expect(result.items).toHaveLength(8);
    });

    it('rejects item with empty value', () => {
      expectFailure({
        ...minimal,
        items: [{ value: '', label: 'test' }],
      });
    });

    it('rejects item with empty label', () => {
      expectFailure({
        ...minimal,
        items: [{ value: '1', label: '' }],
      });
    });

    it('rejects item value exceeding 50 chars', () => {
      expectFailure({
        ...minimal,
        items: [{ value: 'x'.repeat(51), label: 'test' }],
      });
    });

    it('rejects item label exceeding 100 chars', () => {
      expectFailure({
        ...minimal,
        items: [{ value: '1', label: 'x'.repeat(101) }],
      });
    });

    it('accepts item value at max 50 chars', () => {
      const result = expectSuccess({
        ...minimal,
        items: [{ value: 'x'.repeat(50), label: 'test' }],
      }) as DrawStatsBar;
      expect(result.items[0].value).toHaveLength(50);
    });

    it('accepts item label at max 100 chars', () => {
      const result = expectSuccess({
        ...minimal,
        items: [{ value: '1', label: 'x'.repeat(100) }],
      }) as DrawStatsBar;
      expect(result.items[0].label).toHaveLength(100);
    });

    it('rejects valueFontSize below 8', () => {
      expectFailure({ ...minimal, valueFontSize: 7 });
    });

    it('rejects valueFontSize above 72', () => {
      expectFailure({ ...minimal, valueFontSize: 73 });
    });

    it('rejects labelFontSize below 8', () => {
      expectFailure({ ...minimal, labelFontSize: 7 });
    });

    it('rejects labelFontSize above 72', () => {
      expectFailure({ ...minimal, labelFontSize: 73 });
    });

    it('rejects valueFontWeight below 100', () => {
      expectFailure({ ...minimal, valueFontWeight: 99 });
    });

    it('rejects valueFontWeight above 900', () => {
      expectFailure({ ...minimal, valueFontWeight: 901 });
    });

    it('rejects non-integer valueFontWeight', () => {
      expectFailure({ ...minimal, valueFontWeight: 400.5 });
    });

    it('rejects labelFontWeight below 100', () => {
      expectFailure({ ...minimal, labelFontWeight: 99 });
    });

    it('rejects labelFontWeight above 900', () => {
      expectFailure({ ...minimal, labelFontWeight: 901 });
    });

    it('rejects non-integer labelFontWeight', () => {
      expectFailure({ ...minimal, labelFontWeight: 400.5 });
    });

    it('rejects gap below 0', () => {
      expectFailure({ ...minimal, gap: -1 });
    });

    it('rejects gap above 100', () => {
      expectFailure({ ...minimal, gap: 101 });
    });

    it('rejects opacity below 0', () => {
      expectFailure({ ...minimal, opacity: -0.1 });
    });

    it('rejects opacity above 1', () => {
      expectFailure({ ...minimal, opacity: 1.1 });
    });

    it('rejects invalid separator value', () => {
      expectFailure({ ...minimal, separator: 'dash' });
    });

    it('rejects invalid fontFamily', () => {
      expectFailure({ ...minimal, valueFontFamily: 'comic-sans' });
    });

    it('rejects invalid color hex', () => {
      expectFailure({ ...minimal, valueColor: 'not-a-color' });
    });

    it('rejects missing y', () => {
      const { y: _, ...noY } = minimal;
      expectFailure(noY);
    });

    it('rejects missing items', () => {
      const { items: _, ...noItems } = minimal;
      expectFailure(noItems);
    });
  });

  describe('discriminated union registration', () => {
    it('coexists with other draw commands in the same spec', () => {
      const result = designSpecSchema.parse({
        version: 2,
        draw: [
          { type: 'rect', x: 0, y: 0, width: 100, height: 50 },
          {
            type: 'stats-bar',
            y: 600,
            items: [
              { value: '150+', label: 'commits' },
              { value: '50+', label: 'PRs' },
            ],
          },
          { type: 'text', x: 0, y: 0, text: 'plain' },
        ],
      });
      expect(result.draw).toHaveLength(3);
      expect(result.draw[0].type).toBe('rect');
      expect(result.draw[1].type).toBe('stats-bar');
      expect(result.draw[2].type).toBe('text');
    });
  });

  describe('type exports', () => {
    it('DrawStatsBar type is usable', () => {
      const bar: DrawStatsBar = {
        type: 'stats-bar',
        y: 600,
        items: [{ value: '150+', label: 'commits' }],
        separator: 'dot',
        valueColor: '#FFFFFF',
        valueFontSize: 18,
        valueFontWeight: 700,
        valueFontFamily: 'mono',
        labelColor: '#AAAAAA',
        labelFontSize: 14,
        labelFontWeight: 400,
        labelFontFamily: 'body',
        separatorColor: '#666666',
        gap: 24,
        opacity: 1,
      };
      expect(bar.type).toBe('stats-bar');
    });

    it('DrawStatsBarItem type is usable', () => {
      const item: DrawStatsBarItem = {
        value: '150+',
        label: 'commits',
      };
      expect(item.value).toBe('150+');
    });
  });
});
