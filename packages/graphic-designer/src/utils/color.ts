type RGB = { r: number; g: number; b: number };

function parseChannel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16);
}

export function parseHexColor(hexColor: string): RGB {
  const normalized = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  if (normalized.length !== 6 && normalized.length !== 8) {
    throw new Error(`Unsupported color format: ${hexColor}`);
  }

  return {
    r: parseChannel(normalized, 0),
    g: parseChannel(normalized, 2),
    b: parseChannel(normalized, 4),
  };
}

/** Regex matching `rgb(r, g, b)` or `rgba(r, g, b, a)` with optional whitespace. */
const rgbaRegex =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([01](?:\.\d+)?|0?\.\d+)\s*)?\)$/;

/** Regex matching `#RRGGBB` or `#RRGGBBAA` hex colors. */
const hexColorRegex = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

/**
 * Parse an `rgb()` or `rgba()` CSS color string and return the equivalent
 * `#RRGGBB` or `#RRGGBBAA` hex string.
 *
 * @throws {Error} When the string does not match a valid rgb/rgba pattern or
 *   channel values are out of range.
 */
export function parseRgbaToHex(color: string): string {
  const match = rgbaRegex.exec(color);
  if (!match) {
    throw new Error(`Invalid rgb/rgba color: ${color}`);
  }

  const r = Number.parseInt(match[1], 10);
  const g = Number.parseInt(match[2], 10);
  const b = Number.parseInt(match[3], 10);

  if (r > 255 || g > 255 || b > 255) {
    throw new Error(`RGB channel values must be 0-255, got: ${color}`);
  }

  if (match[4] !== undefined) {
    const a = Number.parseFloat(match[4]);
    if (a < 0 || a > 1) {
      throw new Error(`Alpha value must be 0-1, got: ${a}`);
    }
    const alphaByte = Math.round(a * 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(alphaByte)}`;
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Check whether a string looks like an `rgb()` or `rgba()` color.
 */
export function isRgbaColor(color: string): boolean {
  return rgbaRegex.test(color);
}

/**
 * Check whether a string is a valid hex color (`#RRGGBB` or `#RRGGBBAA`).
 */
export function isHexColor(color: string): boolean {
  return hexColorRegex.test(color);
}

/**
 * Normalise a color string to `#RRGGBB` or `#RRGGBBAA` hex format.
 *
 * Accepts:
 * - `#RRGGBB` / `#RRGGBBAA` (returned as-is)
 * - `rgb(r, g, b)` → converted to `#RRGGBB`
 * - `rgba(r, g, b, a)` → converted to `#RRGGBBAA`
 *
 * @throws {Error} When the input is not a recognised color format.
 */
export function normalizeColor(color: string): string {
  if (isHexColor(color)) {
    return color;
  }
  if (isRgbaColor(color)) {
    return parseRgbaToHex(color);
  }
  throw new Error(`Expected #RRGGBB, #RRGGBBAA, rgb(), or rgba() color, got: ${color}`);
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hexColor: string): number {
  const normalized = isRgbaColor(hexColor) ? parseRgbaToHex(hexColor) : hexColor;
  const rgb = parseHexColor(normalized);
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Blend a foreground color with a background color at the given opacity using
 * standard alpha compositing (source-over).
 *
 * Returns an opaque `#RRGGBB` hex string representing the effective color a
 * viewer would perceive when the foreground is painted at {@link opacity} over
 * the background.
 *
 * @param foreground - Hex color of the semi-transparent layer (`#RRGGBB` or
 *   `#RRGGBBAA`).
 * @param background - Hex color of the opaque surface behind the layer.
 * @param opacity - Alpha multiplier in the range `[0, 1]`.
 * @returns The composited color as `#RRGGBB`.
 */
export function blendColorWithOpacity(
  foreground: string,
  background: string,
  opacity: number,
): string {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  const r = Math.round(fg.r * opacity + bg.r * (1 - opacity));
  const g = Math.round(fg.g * opacity + bg.g * (1 - opacity));
  const b = Math.round(fg.b * opacity + bg.b * (1 - opacity));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}
