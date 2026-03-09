import type { SKRSContext2D } from '@napi-rs/canvas';
import { drawRoundedRect } from '../primitives/shapes.js';
import { applyFont, drawTextBlock, resolveFont } from '../primitives/text.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { CardElement, Theme } from '../spec.schema.js';

const TONE_BADGE_COLORS: Record<NonNullable<CardElement['tone']>, string> = {
  neutral: '#334B83',
  accent: '#1E7A58',
  success: '#166A45',
  warning: '#7A5418',
  error: '#8A2C2C',
};

export function renderCard(
  ctx: SKRSContext2D,
  card: CardElement,
  rect: Rect,
  theme: Theme,
): RenderedElement[] {
  const headingFont = resolveFont(theme.fonts.heading, 'heading');
  const bodyFont = resolveFont(theme.fonts.body, 'body');
  const monoFont = resolveFont(theme.fonts.mono, 'mono');

  ctx.lineWidth = 1;
  drawRoundedRect(ctx, rect, 14, theme.surface, theme.border);

  const elements: RenderedElement[] = [];

  const padding = 18;
  const innerLeft = rect.x + padding;
  const innerWidth = rect.width - padding * 2;
  let cursorY = rect.y + padding;

  if (card.badge) {
    applyFont(ctx, { size: 13, weight: 700, family: monoFont });
    const label = card.badge.toUpperCase();
    const badgeWidth = Math.ceil(ctx.measureText(label).width + 18);
    const badgeRect: Rect = {
      x: innerLeft,
      y: cursorY,
      width: badgeWidth,
      height: 24,
    };
    const badgeBg = TONE_BADGE_COLORS[card.tone ?? 'neutral'];
    drawRoundedRect(ctx, badgeRect, 12, badgeBg);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, badgeRect.x + 9, badgeRect.y + 16);

    elements.push({
      id: `card-${card.id}-badge`,
      kind: 'badge',
      bounds: badgeRect,
      foregroundColor: '#FFFFFF',
      backgroundColor: badgeBg,
    });

    cursorY += 34;
  }

  const titleBlock = drawTextBlock(ctx, {
    x: innerLeft,
    y: cursorY + 22,
    maxWidth: innerWidth,
    lineHeight: 26,
    color: theme.text,
    text: card.title,
    maxLines: 2,
    fontSize: 22,
    fontWeight: 700,
    family: headingFont,
  });
  cursorY += titleBlock.height + 18;

  const bodyBlock = drawTextBlock(ctx, {
    x: innerLeft,
    y: cursorY + 20,
    maxWidth: innerWidth,
    lineHeight: 22,
    color: theme.textMuted,
    text: card.body,
    maxLines: 4,
    fontSize: 18,
    fontWeight: 500,
    family: bodyFont,
  });

  let cardTruncated = titleBlock.truncated || bodyBlock.truncated;

  if (card.metric) {
    applyFont(ctx, { size: 34, weight: 700, family: headingFont });
    ctx.fillStyle = theme.accent;
    ctx.fillText(card.metric, innerLeft, rect.y + rect.height - 20);
    elements.push({
      id: `card-${card.id}-metric`,
      kind: 'text',
      bounds: {
        x: innerLeft,
        y: rect.y + rect.height - 54,
        width: innerWidth,
        height: 40,
      },
      foregroundColor: theme.accent,
      backgroundColor: theme.surface,
    });
  }

  if (cursorY + bodyBlock.height + 24 > rect.y + rect.height) {
    cardTruncated = true;
  }

  elements.push({
    id: `card-${card.id}`,
    kind: 'card',
    bounds: rect,
    foregroundColor: theme.text,
    backgroundColor: theme.surface,
    truncated: cardTruncated,
  });
  elements.push({
    id: `card-${card.id}-body`,
    kind: 'text',
    bounds: {
      x: innerLeft,
      y: rect.y + 10,
      width: innerWidth,
      height: rect.height - 20,
    },
    foregroundColor: theme.textMuted,
    backgroundColor: theme.surface,
    truncated: cardTruncated,
  });

  return elements;
}
