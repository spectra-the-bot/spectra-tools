import type { SKRSContext2D } from '@napi-rs/canvas';
import type { Rect, RenderedElement } from '../renderer.js';
import type { TextElement, Theme } from '../spec.schema.js';
import { applyFont, resolveFont, wrapText } from '../primitives/text.js';

type TextStyleDef = {
  fontSize: number;
  weight: number;
  lineHeight: number;
  familyRole: 'heading' | 'body' | 'mono';
};

const TEXT_STYLE_MAP: Record<TextElement['style'], TextStyleDef> = {
  heading: { fontSize: 42, weight: 700, lineHeight: 48, familyRole: 'heading' },
  subheading: { fontSize: 28, weight: 600, lineHeight: 34, familyRole: 'body' },
  body: { fontSize: 20, weight: 500, lineHeight: 26, familyRole: 'body' },
  caption: { fontSize: 14, weight: 500, lineHeight: 18, familyRole: 'body' },
  code: { fontSize: 16, weight: 500, lineHeight: 22, familyRole: 'mono' },
};

export function renderTextElement(
  ctx: SKRSContext2D,
  textEl: TextElement,
  bounds: Rect,
  theme: Theme,
): RenderedElement[] {
  const style = TEXT_STYLE_MAP[textEl.style];
  const familyName = resolveFont(theme.fonts[style.familyRole], style.familyRole);
  const maxLines = Math.max(1, Math.floor(bounds.height / style.lineHeight));

  applyFont(ctx, { size: style.fontSize, weight: style.weight, family: familyName });
  const wrapped = wrapText(ctx, textEl.content, bounds.width, maxLines);

  ctx.fillStyle = textEl.color ?? theme.text;
  ctx.textAlign = textEl.align;

  const x =
    textEl.align === 'center' ? bounds.x + bounds.width / 2 : textEl.align === 'right' ? bounds.x + bounds.width : bounds.x;

  for (const [index, line] of wrapped.lines.entries()) {
    ctx.fillText(line, x, bounds.y + style.fontSize + index * style.lineHeight);
  }

  ctx.textAlign = 'left';

  return [
    {
      id: `text-${textEl.id}`,
      kind: 'text',
      bounds,
      foregroundColor: textEl.color ?? theme.text,
      truncated: wrapped.truncated,
    },
  ];
}
