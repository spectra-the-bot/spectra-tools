import type { SKRSContext2D } from '@napi-rs/canvas';
import type { Rect } from '../renderer.js';
import type { Point } from './lines.js';
import { drawRoundedRect } from './shapes.js';

export type WrappedLines = {
  lines: string[];
  truncated: boolean;
};

const SUPPORTED_FONT_FAMILIES = new Set(['Inter', 'JetBrains Mono', 'Space Grotesk']);

export function resolveFont(requested: string, role: 'heading' | 'body' | 'mono'): string {
  if (SUPPORTED_FONT_FAMILIES.has(requested)) {
    return requested;
  }

  if (role === 'mono' || /mono|code|terminal|console/iu.test(requested)) {
    return 'JetBrains Mono';
  }

  if (role === 'heading' || /display|grotesk|headline/iu.test(requested)) {
    return 'Space Grotesk';
  }

  return 'Inter';
}

export function applyFont(
  ctx: SKRSContext2D,
  options: { size: number; weight: number; family: string },
): void {
  ctx.font = `${options.weight} ${options.size}px ${options.family}`;
}

export function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): WrappedLines {
  const trimmed = text.trim();
  if (!trimmed) {
    return { lines: [], truncated: false };
  }

  const words = trimmed.split(/\s+/u);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const trial = current.length > 0 ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = '';
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && current.length > 0) {
    lines.push(current);
  }

  const wasTruncated = lines.length >= maxLines && words.join(' ') !== lines.join(' ');
  if (!wasTruncated) {
    return { lines, truncated: false };
  }

  const lastIndex = lines.length - 1;
  let truncatedLine = `${lines[lastIndex]}…`;
  while (truncatedLine.length > 1 && ctx.measureText(truncatedLine).width > maxWidth) {
    truncatedLine = `${truncatedLine.slice(0, -2)}…`;
  }
  lines[lastIndex] = truncatedLine;

  return { lines, truncated: true };
}

export function drawTextBlock(
  ctx: SKRSContext2D,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    lineHeight: number;
    color: string;
    text: string;
    maxLines: number;
    fontSize: number;
    fontWeight: number;
    family: string;
  },
): { height: number; truncated: boolean } {
  applyFont(ctx, { size: options.fontSize, weight: options.fontWeight, family: options.family });
  const wrapped = wrapText(ctx, options.text, options.maxWidth, options.maxLines);

  ctx.fillStyle = options.color;
  for (const [index, line] of wrapped.lines.entries()) {
    ctx.fillText(line, options.x, options.y + index * options.lineHeight);
  }

  return {
    height: wrapped.lines.length * options.lineHeight,
    truncated: wrapped.truncated,
  };
}

export function drawTextLabel(
  ctx: SKRSContext2D,
  text: string,
  position: Point,
  options: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    padding: number;
    borderRadius: number;
  },
): Rect {
  applyFont(ctx, { size: options.fontSize, weight: 600, family: options.fontFamily });
  const textWidth = Math.ceil(ctx.measureText(text).width);

  const rect: Rect = {
    x: Math.round(position.x - (textWidth + options.padding * 2) / 2),
    y: Math.round(position.y - (options.fontSize + options.padding * 2) / 2),
    width: textWidth + options.padding * 2,
    height: options.fontSize + options.padding * 2,
  };

  drawRoundedRect(ctx, rect, options.borderRadius, options.backgroundColor);
  ctx.fillStyle = options.color;
  ctx.fillText(text, rect.x + options.padding, rect.y + rect.height - options.padding);

  return rect;
}

export function drawMonoText(
  ctx: SKRSContext2D,
  lines: string[],
  options: {
    x: number;
    y: number;
    lineHeight: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    showLineNumbers?: boolean;
    startLine?: number;
    highlightLines?: number[];
    highlightColor?: string;
    lineNumberColor?: string;
  },
): { height: number } {
  applyFont(ctx, { size: options.fontSize, weight: 500, family: options.fontFamily });

  const firstLine = options.startLine ?? 1;
  const highlighted = new Set(options.highlightLines ?? []);
  const lineNumberWidth = options.showLineNumbers
    ? Math.max(28, ctx.measureText(String(firstLine + Math.max(0, lines.length - 1))).width + 12)
    : 0;

  for (const [index, line] of lines.entries()) {
    const lineNo = firstLine + index;
    const y = options.y + index * options.lineHeight;

    if (highlighted.has(lineNo)) {
      ctx.fillStyle = options.highlightColor ?? 'rgba(122, 162, 255, 0.16)';
      const lineWidth = ctx.measureText(line).width;
      ctx.fillRect(
        options.x - 4,
        y - options.lineHeight + 4,
        lineNumberWidth + lineWidth + 12,
        options.lineHeight,
      );
    }

    if (options.showLineNumbers) {
      ctx.fillStyle = options.lineNumberColor ?? options.color;
      ctx.fillText(String(lineNo).padStart(2, ' '), options.x, y);
    }

    ctx.fillStyle = options.color;
    ctx.fillText(line, options.x + lineNumberWidth, y);
  }

  return {
    height: lines.length * options.lineHeight,
  };
}
