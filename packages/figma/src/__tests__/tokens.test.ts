import { describe, expect, it } from 'vitest';
import { toDtcg } from '../tokens/dtcg.js';
import { type ExtractedTokens, extractTokens, toFlatTokens } from '../tokens/extractor.js';

// ---------------------------------------------------------------------------
// Mock Figma file data
// ---------------------------------------------------------------------------

function makeDocument(nodes: Record<string, unknown>[]) {
  return {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Page 1',
        type: 'CANVAS',
        children: nodes,
      },
    ],
  };
}

function makeColorNode(id: string, name: string, r: number, g: number, b: number, a = 1) {
  return {
    id,
    name,
    type: 'RECTANGLE',
    fills: [{ type: 'SOLID', color: { r, g, b, a }, visible: true }],
    styles: { fill: id },
  };
}

function makeTextNode(
  id: string,
  name: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
) {
  return {
    id,
    name,
    type: 'TEXT',
    style: {
      fontFamily,
      fontSize,
      fontWeight,
      lineHeightPx: fontSize * 1.5,
      letterSpacing: 0,
    },
    styles: { text: id },
  };
}

function makeEffectNode(id: string, name: string) {
  return {
    id,
    name,
    type: 'RECTANGLE',
    effects: [
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
      },
    ],
    styles: { effect: id },
  };
}

function makeStyles(
  entries: Array<{ id: string; name: string; style_type: string }>,
): Record<string, { key: string; name: string; style_type: string }> {
  const styles: Record<string, { key: string; name: string; style_type: string }> = {};
  for (const e of entries) {
    styles[e.id] = { key: e.id, name: e.name, style_type: e.style_type };
  }
  return styles;
}

// ---------------------------------------------------------------------------
// extractTokens tests
// ---------------------------------------------------------------------------

describe('extractTokens', () => {
  it('extracts color tokens from paint styles', () => {
    const doc = makeDocument([makeColorNode('100:1', 'Primary Blue', 0, 0.4, 1)]);
    const styles = makeStyles([{ id: '100:1', name: 'Primary Blue', style_type: 'FILL' }]);

    const result = extractTokens(doc, styles);

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0]?.name).toBe('Primary Blue');
    expect(result.colors[0]?.hex).toBe('#0066ff');
    expect(result.colors[0]?.rgba.r).toBe(0);
    expect(result.colors[0]?.rgba.b).toBe(255);
  });

  it('extracts typography tokens from text styles', () => {
    const doc = makeDocument([makeTextNode('200:1', 'Heading 1', 'Inter', 32, 700)]);
    const styles = makeStyles([{ id: '200:1', name: 'Heading 1', style_type: 'TEXT' }]);

    const result = extractTokens(doc, styles);

    expect(result.typography).toHaveLength(1);
    expect(result.typography[0]?.name).toBe('Heading 1');
    expect(result.typography[0]?.fontFamily).toBe('Inter');
    expect(result.typography[0]?.fontSize).toBe(32);
    expect(result.typography[0]?.fontWeight).toBe(700);
    expect(result.typography[0]?.lineHeight).toBe(48);
  });

  it('extracts effect tokens (drop shadow)', () => {
    const doc = makeDocument([makeEffectNode('300:1', 'Card Shadow')]);
    const styles = makeStyles([{ id: '300:1', name: 'Card Shadow', style_type: 'EFFECT' }]);

    const result = extractTokens(doc, styles);

    expect(result.effects).toHaveLength(1);
    const effect = result.effects[0];
    expect(effect?.name).toBe('Card Shadow');
    expect(effect?.type).toBe('drop-shadow');
    expect(effect).toBeDefined();
    if (effect && 'color' in effect) {
      expect(effect.offsetY).toBe(4);
      expect(effect.radius).toBe(8);
    }
  });

  it('returns empty arrays when no styles defined', () => {
    const doc = makeDocument([]);
    const result = extractTokens(doc, undefined);
    expect(result.colors).toHaveLength(0);
    expect(result.typography).toHaveLength(0);
    expect(result.effects).toHaveLength(0);
  });

  it('returns empty arrays when styles map is empty', () => {
    const doc = makeDocument([]);
    const result = extractTokens(doc, {});
    expect(result.colors).toHaveLength(0);
    expect(result.typography).toHaveLength(0);
    expect(result.effects).toHaveLength(0);
  });

  it('filters by colors only', () => {
    const doc = makeDocument([
      makeColorNode('100:1', 'Red', 1, 0, 0),
      makeTextNode('200:1', 'Body', 'Inter', 16, 400),
    ]);
    const styles = makeStyles([
      { id: '100:1', name: 'Red', style_type: 'FILL' },
      { id: '200:1', name: 'Body', style_type: 'TEXT' },
    ]);

    const result = extractTokens(doc, styles, 'colors');

    expect(result.colors).toHaveLength(1);
    expect(result.typography).toHaveLength(0);
    expect(result.effects).toHaveLength(0);
  });

  it('filters by typography only', () => {
    const doc = makeDocument([
      makeColorNode('100:1', 'Red', 1, 0, 0),
      makeTextNode('200:1', 'Body', 'Inter', 16, 400),
    ]);
    const styles = makeStyles([
      { id: '100:1', name: 'Red', style_type: 'FILL' },
      { id: '200:1', name: 'Body', style_type: 'TEXT' },
    ]);

    const result = extractTokens(doc, styles, 'typography');

    expect(result.colors).toHaveLength(0);
    expect(result.typography).toHaveLength(1);
  });

  it('handles color with opacity', () => {
    const doc = makeDocument([
      {
        id: '100:1',
        name: 'Overlay',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }],
        styles: { fill: '100:1' },
      },
    ]);
    const styles = makeStyles([{ id: '100:1', name: 'Overlay', style_type: 'FILL' }]);

    const result = extractTokens(doc, styles);

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0]?.rgba.a).toBe(0.5);
    // Should include alpha channel in hex
    expect(result.colors[0]?.hex).toContain('#000000');
  });

  it('skips gradient paints (non-SOLID)', () => {
    const doc = makeDocument([
      {
        id: '100:1',
        name: 'Gradient',
        type: 'RECTANGLE',
        fills: [{ type: 'GRADIENT_LINEAR', visible: true }],
        styles: { fill: '100:1' },
      },
    ]);
    const styles = makeStyles([{ id: '100:1', name: 'Gradient', style_type: 'FILL' }]);

    const result = extractTokens(doc, styles);

    // Gradient paints have no solid color to extract
    expect(result.colors).toHaveLength(0);
  });

  it('handles unnamed styles gracefully', () => {
    const doc = makeDocument([makeColorNode('100:1', '', 1, 0, 0)]);
    const styles = makeStyles([{ id: '100:1', name: '', style_type: 'FILL' }]);

    const result = extractTokens(doc, styles);

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0]?.name).toBe('unnamed');
  });

  it('skips invisible effects', () => {
    const doc = makeDocument([
      {
        id: '300:1',
        name: 'Hidden Shadow',
        type: 'RECTANGLE',
        effects: [
          {
            type: 'DROP_SHADOW',
            visible: false,
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 0, y: 4 },
            radius: 8,
            spread: 0,
          },
        ],
        styles: { effect: '300:1' },
      },
    ]);
    const styles = makeStyles([{ id: '300:1', name: 'Hidden Shadow', style_type: 'EFFECT' }]);

    const result = extractTokens(doc, styles);

    expect(result.effects).toHaveLength(0);
  });

  it('extracts blur effects', () => {
    const doc = makeDocument([
      {
        id: '300:1',
        name: 'Glass Blur',
        type: 'RECTANGLE',
        effects: [
          {
            type: 'BACKGROUND_BLUR',
            visible: true,
            radius: 20,
          },
        ],
        styles: { effect: '300:1' },
      },
    ]);
    const styles = makeStyles([{ id: '300:1', name: 'Glass Blur', style_type: 'EFFECT' }]);

    const result = extractTokens(doc, styles);

    expect(result.effects).toHaveLength(1);
    expect(result.effects[0]?.type).toBe('background-blur');
    const blurEffect = result.effects[0];
    expect(blurEffect).toBeDefined();
    if (blurEffect && !('color' in blurEffect)) {
      expect(blurEffect.radius).toBe(20);
    }
  });
});

// ---------------------------------------------------------------------------
// toFlatTokens tests
// ---------------------------------------------------------------------------

describe('toFlatTokens', () => {
  it('produces flat key-value pairs for colors', () => {
    const tokens: ExtractedTokens = {
      colors: [{ name: 'Primary', hex: '#0066ff', rgba: { r: 0, g: 102, b: 255, a: 1 } }],
      typography: [],
      effects: [],
    };

    const flat = toFlatTokens(tokens);

    expect(flat['color.primary']).toBe('#0066ff');
  });

  it('produces flat key-value pairs for typography', () => {
    const tokens: ExtractedTokens = {
      colors: [],
      typography: [
        {
          name: 'Heading 1',
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 48,
          letterSpacing: 0,
        },
      ],
      effects: [],
    };

    const flat = toFlatTokens(tokens);

    expect(flat['typography.heading-1.fontFamily']).toBe('Inter');
    expect(flat['typography.heading-1.fontSize']).toBe(32);
    expect(flat['typography.heading-1.fontWeight']).toBe(700);
    expect(flat['typography.heading-1.lineHeight']).toBe(48);
  });

  it('produces flat key-value pairs for shadow effects', () => {
    const tokens: ExtractedTokens = {
      colors: [],
      typography: [],
      effects: [
        {
          name: 'Card Shadow',
          type: 'drop-shadow',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offsetX: 0,
          offsetY: 4,
          radius: 8,
          spread: 0,
        },
      ],
    };

    const flat = toFlatTokens(tokens);

    expect(flat['effect.card-shadow.type']).toBe('drop-shadow');
    expect(flat['effect.card-shadow.offsetY']).toBe(4);
    expect(flat['effect.card-shadow.radius']).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// toDtcg tests
// ---------------------------------------------------------------------------

describe('toDtcg', () => {
  it('produces DTCG-compliant color tokens', () => {
    const tokens: ExtractedTokens = {
      colors: [{ name: 'Primary', hex: '#0066ff', rgba: { r: 0, g: 102, b: 255, a: 1 } }],
      typography: [],
      effects: [],
    };

    const dtcg = toDtcg(tokens);

    expect(dtcg.color).toBeDefined();
    const primary = dtcg.color?.primary as { $type: string; $value: string };
    expect(primary.$type).toBe('color');
    expect(primary.$value).toBe('#0066ff');
  });

  it('produces DTCG-compliant typography tokens', () => {
    const tokens: ExtractedTokens = {
      colors: [],
      typography: [
        {
          name: 'Heading 1',
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 48,
          letterSpacing: 0,
        },
      ],
      effects: [],
    };

    const dtcg = toDtcg(tokens);

    expect(dtcg.typography).toBeDefined();
    const heading = dtcg.typography?.['heading-1'] as Record<
      string,
      { $type: string; $value: unknown }
    >;
    expect(heading.fontFamily.$type).toBe('fontFamily');
    expect(heading.fontFamily.$value).toBe('Inter');
    expect(heading.fontSize.$type).toBe('dimension');
    expect(heading.fontSize.$value).toBe('32px');
    expect(heading.fontWeight.$type).toBe('fontWeight');
    expect(heading.fontWeight.$value).toBe(700);
  });

  it('produces DTCG-compliant shadow tokens', () => {
    const tokens: ExtractedTokens = {
      colors: [],
      typography: [],
      effects: [
        {
          name: 'Elevation 1',
          type: 'drop-shadow',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offsetX: 0,
          offsetY: 4,
          radius: 8,
          spread: 0,
        },
      ],
    };

    const dtcg = toDtcg(tokens);

    expect(dtcg.effect).toBeDefined();
    const shadow = dtcg.effect?.['elevation-1'] as {
      $type: string;
      $value: Record<string, string>;
    };
    expect(shadow.$type).toBe('shadow');
    expect(shadow.$value.offsetY).toBe('4px');
    expect(shadow.$value.blur).toBe('8px');
  });

  it('omits empty groups', () => {
    const tokens: ExtractedTokens = {
      colors: [],
      typography: [],
      effects: [],
    };

    const dtcg = toDtcg(tokens);

    expect(dtcg.color).toBeUndefined();
    expect(dtcg.typography).toBeUndefined();
    expect(dtcg.effect).toBeUndefined();
  });

  it('handles multiple tokens in each category', () => {
    const tokens: ExtractedTokens = {
      colors: [
        { name: 'Red', hex: '#ff0000', rgba: { r: 255, g: 0, b: 0, a: 1 } },
        { name: 'Blue', hex: '#0000ff', rgba: { r: 0, g: 0, b: 255, a: 1 } },
      ],
      typography: [],
      effects: [],
    };

    const dtcg = toDtcg(tokens);

    expect(Object.keys(dtcg.color || {})).toHaveLength(2);
    expect(dtcg.color?.red).toBeDefined();
    expect(dtcg.color?.blue).toBeDefined();
  });

  it('includes lineHeight only when present', () => {
    const tokens: ExtractedTokens = {
      colors: [],
      typography: [
        {
          name: 'Caption',
          fontFamily: 'Arial',
          fontSize: 12,
          fontWeight: 400,
          lineHeight: null,
          letterSpacing: 0.5,
        },
      ],
      effects: [],
    };

    const dtcg = toDtcg(tokens);
    const caption = dtcg.typography?.caption as Record<string, { $type: string; $value: unknown }>;

    expect(caption.fontFamily).toBeDefined();
    expect(caption.lineHeight).toBeUndefined();
    expect(caption.letterSpacing.$value).toBe('0.5px');
  });
});
