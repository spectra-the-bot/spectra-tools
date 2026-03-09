import type { SKRSContext2D } from '@napi-rs/canvas';
import { resolveCodeBlockStyle } from '../code-style.js';
import { drawRoundedRect, roundRectPath } from '../primitives/shapes.js';
import { applyFont, resolveFont } from '../primitives/text.js';
import { drawWindowChrome } from '../primitives/window-chrome.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { TerminalElement, Theme } from '../spec.schema.js';

const CONTAINER_RADIUS = 5;

function insetBounds(bounds: Rect, horizontal: number, vertical: number): Rect {
  return {
    x: bounds.x + horizontal,
    y: bounds.y + vertical,
    width: Math.max(1, bounds.width - horizontal * 2),
    height: Math.max(1, bounds.height - vertical * 2),
  };
}

export function renderTerminal(
  ctx: SKRSContext2D,
  terminal: TerminalElement,
  bounds: Rect,
  theme: Theme,
): RenderedElement[] {
  const bodyFont = resolveFont(theme.fonts.body, 'body');
  const monoFont = resolveFont(theme.fonts.mono, 'mono');
  const style = resolveCodeBlockStyle(terminal.style);

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
    title: terminal.title ?? 'Terminal',
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

  const prompt = terminal.prompt ?? '$';
  const lines = terminal.content.split(/\r?\n/u).map((line) => {
    if (!terminal.showPrompt || line.trim().length === 0) {
      return line;
    }
    return `${prompt} ${line}`;
  });

  applyFont(ctx, { size: style.fontSize, weight: 500, family: monoFont });
  ctx.fillStyle = theme.code.text;

  const lineHeight = Math.max(1, Math.round((style.fontSize * style.lineHeightPercent) / 100));
  const firstBaselineY = contentRect.y + style.fontSize;
  const contentBottom = contentRect.y + contentRect.height;

  for (const [index, line] of lines.entries()) {
    const y = firstBaselineY + index * lineHeight;
    if (y > contentBottom) {
      break;
    }
    ctx.fillText(line, contentRect.x, y);
  }

  ctx.restore();

  return [
    {
      id: `terminal-${terminal.id}`,
      kind: 'terminal',
      bounds,
      foregroundColor: theme.code.text,
      backgroundColor: theme.code.background,
    },
    {
      id: `terminal-${terminal.id}-content`,
      kind: 'text',
      bounds: contentRect,
      foregroundColor: theme.code.text,
      backgroundColor: theme.code.background,
    },
  ];
}
