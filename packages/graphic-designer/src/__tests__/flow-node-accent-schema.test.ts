import { describe, expect, it } from 'vitest';
import { parseDesignSpec } from '../spec.schema.js';

describe('flow-node accent/glow schema fields', () => {
  const baseNode = { type: 'flow-node' as const, id: 'n1', shape: 'box' as const, label: 'A' };

  it('accepts accentColor with default accentBarWidth', () => {
    const spec = parseDesignSpec({
      elements: [{ ...baseNode, accentColor: '#FF5500' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentColor).toBe('#FF5500');
      expect(n1.accentBarWidth).toBe(3);
    }
  });

  it('accepts custom accentBarWidth', () => {
    const spec = parseDesignSpec({
      elements: [{ ...baseNode, accentColor: '#FF5500', accentBarWidth: 8 }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentBarWidth).toBe(8);
    }
  });

  it('accepts glowColor with default glowWidth and glowOpacity', () => {
    const spec = parseDesignSpec({
      elements: [{ ...baseNode, glowColor: '#00AAFF' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.glowColor).toBe('#00AAFF');
      expect(n1.glowWidth).toBe(16);
      expect(n1.glowOpacity).toBe(0.15);
    }
  });

  it('accepts custom glowWidth and glowOpacity', () => {
    const spec = parseDesignSpec({
      elements: [{ ...baseNode, glowColor: '#00AAFF', glowWidth: 32, glowOpacity: 0.5 }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.glowWidth).toBe(32);
      expect(n1.glowOpacity).toBe(0.5);
    }
  });

  it('accepts accent and glow together', () => {
    const spec = parseDesignSpec({
      elements: [
        {
          ...baseNode,
          accentColor: '#FF5500',
          accentBarWidth: 5,
          glowColor: '#00AAFF',
          glowWidth: 24,
          glowOpacity: 0.3,
        },
      ],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    if (n1?.type === 'flow-node') {
      expect(n1.accentColor).toBe('#FF5500');
      expect(n1.accentBarWidth).toBe(5);
      expect(n1.glowColor).toBe('#00AAFF');
      expect(n1.glowWidth).toBe(24);
      expect(n1.glowOpacity).toBe(0.3);
    }
  });

  it('backward compat: existing flow-node specs without accent/glow still validate', () => {
    const spec = parseDesignSpec({
      elements: [{ type: 'flow-node', id: 'n1', shape: 'rounded-box', label: 'Hello' }],
    });

    const n1 = spec.elements.find((e) => e.type === 'flow-node' && e.id === 'n1');
    expect(n1?.type).toBe('flow-node');
    if (n1?.type === 'flow-node') {
      expect(n1.accentColor).toBeUndefined();
      expect(n1.accentBarWidth).toBe(3);
      expect(n1.glowColor).toBeUndefined();
      expect(n1.glowWidth).toBe(16);
      expect(n1.glowOpacity).toBe(0.15);
    }
  });

  it('strict() still rejects unknown fields', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ ...baseNode, unknownField: 'bad' }],
      }),
    ).toThrow();
  });

  it('rejects accentBarWidth out of range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ ...baseNode, accentBarWidth: 20 }],
      }),
    ).toThrow();
  });

  it('rejects glowWidth out of range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ ...baseNode, glowWidth: 100 }],
      }),
    ).toThrow();
  });

  it('rejects glowOpacity out of range', () => {
    expect(() =>
      parseDesignSpec({
        elements: [{ ...baseNode, glowOpacity: 2 }],
      }),
    ).toThrow();
  });
});
