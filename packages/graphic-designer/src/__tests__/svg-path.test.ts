import { describe, expect, it } from 'vitest';
import { parseSvgPath } from '../utils/svg-path.js';

describe('svg path parser', () => {
  it('parses absolute commands (M, L, H, V, C, Q, Z)', () => {
    const operations = parseSvgPath(
      'M 10 10 L 40 10 H 60 V 40 C 70 50 80 60 90 70 Q 100 80 110 90 Z',
    );

    expect(operations).toEqual([
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 40, y: 10 },
      { type: 'L', x: 60, y: 10 },
      { type: 'L', x: 60, y: 40 },
      { type: 'C', cp1x: 70, cp1y: 50, cp2x: 80, cp2y: 60, x: 90, y: 70 },
      { type: 'Q', cpx: 100, cpy: 80, x: 110, y: 90 },
      { type: 'Z' },
    ]);
  });

  it('parses relative commands and repeated coordinate sets', () => {
    const operations = parseSvgPath('m 10 10 20 0 0 20 h 10 v 10 c 5 0 10 5 15 10 q 10 5 20 0 z');

    expect(operations).toEqual([
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 30, y: 10 },
      { type: 'L', x: 30, y: 30 },
      { type: 'L', x: 40, y: 30 },
      { type: 'L', x: 40, y: 40 },
      { type: 'C', cp1x: 45, cp1y: 40, cp2x: 50, cp2y: 45, x: 55, y: 50 },
      { type: 'Q', cpx: 65, cpy: 55, x: 75, y: 50 },
      { type: 'Z' },
    ]);
  });

  it('throws on unsupported commands', () => {
    expect(() => parseSvgPath('M 0 0 A 10 10 0 0 1 20 20')).toThrow(
      /Unsupported SVG path command/u,
    );
  });
});
