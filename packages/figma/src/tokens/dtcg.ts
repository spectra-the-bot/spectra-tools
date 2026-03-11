/**
 * W3C Design Token Community Group (DTCG) format converter.
 *
 * Converts the normalized intermediate token representation into
 * DTCG-compliant JSON with `$type` and `$value` fields, grouped by
 * token category.
 *
 * @see https://tr.designtokens.org/format/
 */

import type {
  BlurToken,
  ColorToken,
  EffectToken,
  ExtractedTokens,
  ShadowToken,
  TypographyToken,
} from './extractor.js';

// ---------------------------------------------------------------------------
// DTCG output types
// ---------------------------------------------------------------------------

export interface DtcgToken {
  readonly $type: string;
  readonly $value: unknown;
  readonly $description?: string;
}

export interface DtcgGroup {
  readonly [key: string]: DtcgToken | DtcgGroup;
}

export interface DtcgOutput {
  readonly color?: DtcgGroup;
  readonly typography?: DtcgGroup;
  readonly effect?: DtcgGroup;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function colorToDtcgHex(rgba: { r: number; g: number; b: number; a: number }): string {
  const r = rgba.r.toString(16).padStart(2, '0');
  const g = rgba.g.toString(16).padStart(2, '0');
  const b = rgba.b.toString(16).padStart(2, '0');
  if (rgba.a < 1) {
    const a = Math.round(rgba.a * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

function colorToDtcg(token: ColorToken): DtcgToken {
  return {
    $type: 'color',
    $value: colorToDtcgHex(token.rgba),
  };
}

function typographyToDtcg(token: TypographyToken): DtcgGroup {
  const group: Record<string, DtcgToken> = {
    fontFamily: {
      $type: 'fontFamily',
      $value: token.fontFamily,
    },
    fontSize: {
      $type: 'dimension',
      $value: `${token.fontSize}px`,
    },
    fontWeight: {
      $type: 'fontWeight',
      $value: token.fontWeight,
    },
    letterSpacing: {
      $type: 'dimension',
      $value: `${token.letterSpacing}px`,
    },
  };

  if (token.lineHeight !== null) {
    group.lineHeight = {
      $type: 'dimension',
      $value: `${token.lineHeight}px`,
    };
  }

  return group;
}

function shadowToDtcg(token: ShadowToken): DtcgToken {
  return {
    $type: 'shadow',
    $value: {
      color: colorToDtcgHex(token.color),
      offsetX: `${token.offsetX}px`,
      offsetY: `${token.offsetY}px`,
      blur: `${token.radius}px`,
      spread: `${token.spread}px`,
    },
  };
}

function blurToDtcg(token: BlurToken): DtcgToken {
  return {
    $type: 'dimension',
    $value: `${token.radius}px`,
  };
}

function effectToDtcg(token: EffectToken): DtcgToken | DtcgToken {
  if ('color' in token) {
    return shadowToDtcg(token as ShadowToken);
  }
  return blurToDtcg(token as BlurToken);
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

/**
 * Converts extracted tokens to W3C DTCG format.
 */
export function toDtcg(tokens: ExtractedTokens): DtcgOutput {
  const output: Record<string, DtcgGroup> = {};

  if (tokens.colors.length > 0) {
    const group: Record<string, DtcgToken> = {};
    for (const c of tokens.colors) {
      group[slugify(c.name)] = colorToDtcg(c);
    }
    output.color = group;
  }

  if (tokens.typography.length > 0) {
    const group: Record<string, DtcgGroup> = {};
    for (const t of tokens.typography) {
      group[slugify(t.name)] = typographyToDtcg(t);
    }
    output.typography = group;
  }

  if (tokens.effects.length > 0) {
    const group: Record<string, DtcgToken> = {};
    for (const e of tokens.effects) {
      group[slugify(e.name)] = effectToDtcg(e);
    }
    output.effect = group;
  }

  return output;
}
