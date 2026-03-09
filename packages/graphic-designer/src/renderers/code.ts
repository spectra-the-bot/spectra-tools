import type { SKRSContext2D } from '@napi-rs/canvas';
import { resolveCodeBlockStyle } from '../code-style.js';
import { drawRoundedRect, roundRectPath } from '../primitives/shapes.js';
import { applyFont, resolveFont } from '../primitives/text.js';
import { drawWindowChrome } from '../primitives/window-chrome.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { CodeBlockElement, Theme } from '../spec.schema.js';
import { type HighlightedLine, highlightCode } from '../syntax/highlighter.js';
import { resolveShikiTheme } from '../themes/index.js';

const fallbackKeywords = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'import',
  'export',
  'from',
  'as',
  'async',
  'await',
  'try',
  'catch',
  'throw',
  'new',
]);

const CONTAINER_RADIUS = 5;

function tokenizeFallbackLine(line: string, theme: Theme): HighlightedLine['tokens'] {
  if (line.trim().length === 0) {
    return [{ text: line, color: theme.code.text }];
  }

  const tokens: HighlightedLine['tokens'] = [];
  let cursor = 0;

  const push = (text: string, color: string) => {
    if (text.length > 0) {
      tokens.push({ text, color });
    }
  };

  while (cursor < line.length) {
    const rest = line.slice(cursor);

    const whitespace = rest.match(/^\s+/u);
    if (whitespace) {
      push(whitespace[0], theme.code.text);
      cursor += whitespace[0].length;
      continue;
    }

    if (rest.startsWith('//')) {
      push(rest, theme.code.comment);
      break;
    }

    const stringMatch = rest.match(/^(['"`])(?:\\.|(?!\1).)*\1/u);
    if (stringMatch) {
      push(stringMatch[0], theme.code.string);
      cursor += stringMatch[0].length;
      continue;
    }

    const numberMatch = rest.match(/^\d+(?:\.\d+)?/u);
    if (numberMatch) {
      push(numberMatch[0], theme.code.number);
      cursor += numberMatch[0].length;
      continue;
    }

    const operatorMatch = rest.match(/^(===|!==|==|!=|<=|>=|=>|&&|\|\||[+\-*/%=<>!&|^~?:])/u);
    if (operatorMatch) {
      push(operatorMatch[0], theme.code.operator);
      cursor += operatorMatch[0].length;
      continue;
    }

    const punctuationMatch = rest.match(/^[()[\]{}.,;]/u);
    if (punctuationMatch) {
      push(punctuationMatch[0], theme.code.punctuation);
      cursor += punctuationMatch[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/u);
    if (identifierMatch) {
      const identifier = identifierMatch[0];
      const nextChar = rest[identifier.length];

      if (fallbackKeywords.has(identifier)) {
        push(identifier, theme.code.keyword);
      } else if (nextChar === '(') {
        push(identifier, theme.code.function);
      } else {
        push(identifier, theme.code.variable);
      }

      cursor += identifier.length;
      continue;
    }

    push(rest[0], theme.code.text);
    cursor += 1;
  }

  return tokens.length > 0 ? tokens : [{ text: line, color: theme.code.text }];
}

function fallbackHighlightedLines(code: string, theme: Theme): HighlightedLine[] {
  return code.split(/\r?\n/u).map((line) => ({
    tokens: tokenizeFallbackLine(line, theme),
  }));
}

function insetBounds(bounds: Rect, horizontal: number, vertical: number): Rect {
  return {
    x: bounds.x + horizontal,
    y: bounds.y + vertical,
    width: Math.max(1, bounds.width - horizontal * 2),
    height: Math.max(1, bounds.height - vertical * 2),
  };
}

export async function renderCodeBlock(
  ctx: SKRSContext2D,
  block: CodeBlockElement,
  bounds: Rect,
  theme: Theme,
): Promise<RenderedElement[]> {
  const bodyFont = resolveFont(theme.fonts.body, 'body');
  const monoFont = resolveFont(theme.fonts.mono, 'mono');
  const style = resolveCodeBlockStyle(block.style);

  ctx.fillStyle = style.surroundColor;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  const containerRect = insetBounds(bounds, style.paddingHorizontal, style.paddingVertical);

  ctx.save();
  if (style.dropShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = style.dropShadowOffsetY;
    ctx.shadowBlur = style.dropShadowBlurRadius;
  }
  drawRoundedRect(ctx, containerRect, CONTAINER_RADIUS, theme.code.background);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, containerRect, CONTAINER_RADIUS);
  ctx.clip();

  const chrome = drawWindowChrome(ctx, containerRect, {
    style: style.windowControls,
    title: block.title ?? block.language,
    fontFamily: bodyFont,
    backgroundColor: theme.code.background,
  });

  const contentTopPadding = chrome.hasChrome ? 48 : 18;
  const contentRect: Rect = {
    x: containerRect.x + 12,
    y: containerRect.y + contentTopPadding,
    width: Math.max(1, containerRect.width - 30),
    height: Math.max(1, containerRect.height - contentTopPadding - 18),
  };

  const shikiTheme = block.theme ?? resolveShikiTheme(theme);
  let lines: HighlightedLine[];

  try {
    lines = await highlightCode(block.code, block.language, shikiTheme);
  } catch {
    lines = fallbackHighlightedLines(block.code, theme);
  }

  applyFont(ctx, { size: style.fontSize, weight: 500, family: monoFont });

  const firstLine = block.startLine ?? 1;
  const highlighted = new Set(block.highlightLines ?? []);
  const lineNumberWidth = block.showLineNumbers
    ? Math.max(28, ctx.measureText(String(firstLine + Math.max(0, lines.length - 1))).width + 12)
    : 0;

  const lineHeight = Math.max(1, Math.round((style.fontSize * style.lineHeightPercent) / 100));
  const firstBaselineY = contentRect.y + style.fontSize;
  const contentBottom = contentRect.y + contentRect.height;

  for (const [index, line] of lines.entries()) {
    const lineNumber = firstLine + index;
    const y = firstBaselineY + index * lineHeight;
    if (y > contentBottom) {
      break;
    }

    const lineTextWidth = line.tokens.reduce(
      (total, token) => total + ctx.measureText(token.text).width,
      0,
    );

    if (highlighted.has(lineNumber)) {
      ctx.fillStyle = 'rgba(122, 162, 255, 0.18)';
      ctx.fillRect(
        contentRect.x - 4,
        y - lineHeight + 4,
        lineNumberWidth + lineTextWidth + 12,
        lineHeight,
      );
    }

    let x = contentRect.x;

    if (block.showLineNumbers) {
      ctx.fillStyle = theme.code.comment;
      ctx.fillText(String(lineNumber).padStart(2, ' '), x, y);
      x += lineNumberWidth;
    }

    for (const token of line.tokens) {
      ctx.fillStyle = token.color || theme.code.text;
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    }
  }

  ctx.restore();

  return [
    {
      id: `code-${block.id}`,
      kind: 'code-block',
      bounds,
      foregroundColor: theme.code.text,
      backgroundColor: theme.code.background,
    },
    {
      id: `code-${block.id}-content`,
      kind: 'text',
      bounds: contentRect,
      foregroundColor: theme.code.text,
      backgroundColor: theme.code.background,
    },
  ];
}
