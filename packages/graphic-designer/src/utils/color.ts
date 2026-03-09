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

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hexColor: string): number {
  const rgb = parseHexColor(hexColor);
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
