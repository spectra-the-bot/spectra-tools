import type { SKRSContext2D } from '@napi-rs/canvas';
import {
  drawCircle,
  drawCylinder,
  drawDiamond,
  drawParallelogram,
  drawPill,
  drawRoundedRect,
} from '../primitives/shapes.js';
import { applyFont, resolveFont } from '../primitives/text.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { FlowNodeElement, Theme } from '../spec.schema.js';
import { blendColorWithOpacity, withAlpha } from '../utils/color.js';

/** Badge pill constants. */
const BADGE_FONT_SIZE = 10;
const BADGE_FONT_WEIGHT = 600;
const BADGE_LETTER_SPACING = 1;
const BADGE_PADDING_X = 8;
const BADGE_PADDING_Y = 3;
const BADGE_BORDER_RADIUS = 12;
const BADGE_DEFAULT_COLOR = '#FFFFFF';

/**
 * Height of a badge pill including its vertical padding.
 * Used both for rendering and for size estimation.
 */
export const BADGE_PILL_HEIGHT = BADGE_FONT_SIZE + BADGE_PADDING_Y * 2;

/** Extra vertical space added inside a node when `inside-top` badge is present. */
export const BADGE_INSIDE_TOP_EXTRA = BADGE_PILL_HEIGHT + 6;

/**
 * Draw the shape path for a flow-node without managing opacity or line width.
 * This is a pure shape dispatch helper so that the caller can orchestrate fill
 * and stroke passes independently.
 */
function drawNodeShape(
  ctx: SKRSContext2D,
  shape: FlowNodeElement['shape'],
  bounds: Rect,
  fill: string,
  stroke: string | undefined,
  cornerRadius: number,
): void {
  switch (shape) {
    case 'box':
      drawRoundedRect(ctx, bounds, 0, fill, stroke);
      break;
    case 'rounded-box':
      drawRoundedRect(ctx, bounds, cornerRadius, fill, stroke);
      break;
    case 'diamond':
      drawDiamond(ctx, bounds, fill, stroke);
      break;
    case 'circle': {
      const radius = Math.min(bounds.width, bounds.height) / 2;
      drawCircle(
        ctx,
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        radius,
        fill,
        stroke,
      );
      break;
    }
    case 'pill':
      drawPill(ctx, bounds, fill, stroke);
      break;
    case 'cylinder':
      drawCylinder(ctx, bounds, fill, stroke);
      break;
    case 'parallelogram':
      drawParallelogram(ctx, bounds, fill, stroke);
      break;
  }
}

/**
 * Measure text width with letter-spacing applied (manual per-character spacing
 * to stay compatible with @napi-rs/canvas which doesn't support ctx.letterSpacing).
 */
function measureSpacedText(ctx: SKRSContext2D, text: string, letterSpacing: number): number {
  const base = ctx.measureText(text).width;
  const extraChars = [...text].length - 1;
  return extraChars > 0 ? base + extraChars * letterSpacing : base;
}

/**
 * Draw text with manual letter-spacing by rendering character-by-character.
 */
function drawSpacedText(
  ctx: SKRSContext2D,
  text: string,
  centerX: number,
  centerY: number,
  letterSpacing: number,
): void {
  const chars = [...text];
  if (chars.length === 0) return;

  const totalWidth = measureSpacedText(ctx, text, letterSpacing);
  let cursorX = centerX - totalWidth / 2;

  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursorX, centerY);
    cursorX += ctx.measureText(chars[i]).width + (i < chars.length - 1 ? letterSpacing : 0);
  }
}

/**
 * Render a badge pill (rounded rectangle with text) at the given center
 * position. Returns the measured pill width for downstream use.
 */
function renderBadgePill(
  ctx: SKRSContext2D,
  centerX: number,
  centerY: number,
  text: string,
  textColor: string,
  background: string,
  monoFont: string,
): number {
  ctx.save();

  // Measure text width with badge font.
  applyFont(ctx, { size: BADGE_FONT_SIZE, weight: BADGE_FONT_WEIGHT, family: monoFont });
  const textWidth = measureSpacedText(ctx, text, BADGE_LETTER_SPACING);

  const pillWidth = textWidth + BADGE_PADDING_X * 2;
  const pillHeight = BADGE_PILL_HEIGHT;
  const pillX = centerX - pillWidth / 2;
  const pillY = centerY - pillHeight / 2;

  // Draw pill background.
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, BADGE_BORDER_RADIUS);
  ctx.fill();

  // Draw text centered in the pill.
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  applyFont(ctx, { size: BADGE_FONT_SIZE, weight: BADGE_FONT_WEIGHT, family: monoFont });
  drawSpacedText(ctx, text, centerX, centerY, BADGE_LETTER_SPACING);

  ctx.restore();
  return pillWidth;
}

export function renderFlowNode(
  ctx: SKRSContext2D,
  node: FlowNodeElement,
  bounds: Rect,
  theme: Theme,
): RenderedElement[] {
  const fillColor = node.color ?? theme.surfaceElevated;
  const borderColor = node.borderColor ?? theme.border;
  const borderWidth = node.borderWidth ?? 2;
  const cornerRadius = node.cornerRadius ?? 16;
  const labelColor = node.labelColor ?? theme.text;
  const sublabelColor = node.sublabelColor ?? theme.textMuted;
  const labelFontSize = node.labelFontSize ?? 20;
  const fillOpacity = node.fillOpacity ?? 1;

  const hasBadge = !!node.badgeText;
  const badgePosition = node.badgePosition ?? 'inside-top';
  const badgeColor = node.badgeColor ?? BADGE_DEFAULT_COLOR;
  const badgeBackground = node.badgeBackground ?? borderColor ?? theme.accent;

  ctx.save();
  ctx.lineWidth = borderWidth;

  // Apply shadow/glow effect if configured.
  if (node.shadow) {
    const shadowColor = node.shadow.color ?? borderColor ?? theme.accent;
    ctx.shadowColor = withAlpha(shadowColor, node.shadow.opacity);
    ctx.shadowBlur = node.shadow.blur;
    ctx.shadowOffsetX = node.shadow.offsetX;
    ctx.shadowOffsetY = node.shadow.offsetY;
  }

  if (fillOpacity < 1) {
    ctx.globalAlpha = node.opacity * fillOpacity;
    drawNodeShape(ctx, node.shape, bounds, fillColor, undefined, cornerRadius);

    // Clear shadow before stroke pass to avoid double shadow.
    if (node.shadow) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.globalAlpha = node.opacity;
    drawNodeShape(ctx, node.shape, bounds, 'rgba(0,0,0,0)', borderColor, cornerRadius);
  } else {
    ctx.globalAlpha = node.opacity;
    drawNodeShape(ctx, node.shape, bounds, fillColor, borderColor, cornerRadius);
  }

  // Clear shadow so it doesn't affect subsequent draws (text, badge, etc.).
  if (node.shadow) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  const headingFont = resolveFont(theme.fonts.heading, 'heading');
  const bodyFont = resolveFont(theme.fonts.body, 'body');
  const monoFont = resolveFont(theme.fonts.mono, 'mono');
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  // When badge is inside-top, shift the text block down to make room.
  const insideTopShift =
    hasBadge && badgePosition === 'inside-top' ? BADGE_INSIDE_TOP_EXTRA / 2 : 0;

  // Compute text block metrics for vertical centering across 1/2/3 lines.
  const sublabelFontSize = Math.max(12, Math.round(labelFontSize * 0.68));
  const sublabel2FontSize = node.sublabel2FontSize ?? 11;
  const sublabel2Color = node.sublabel2Color ?? sublabelColor;

  const lineCount = node.sublabel2 ? 3 : node.sublabel ? 2 : 1;
  const labelToSublabelGap = Math.max(20, sublabelFontSize + 6);
  const sublabelToSublabel2Gap = sublabel2FontSize + 4;

  let textBlockHeight: number;
  if (lineCount === 1) {
    textBlockHeight = labelFontSize;
  } else if (lineCount === 2) {
    textBlockHeight = labelFontSize + labelToSublabelGap;
  } else {
    textBlockHeight = labelFontSize + labelToSublabelGap + sublabelToSublabel2Gap;
  }

  const labelY =
    lineCount === 1
      ? centerY + labelFontSize * 0.3 + insideTopShift
      : centerY - textBlockHeight / 2 + labelFontSize * 0.8 + insideTopShift;

  ctx.textAlign = 'center';
  applyFont(ctx, { size: labelFontSize, weight: 700, family: headingFont });
  ctx.fillStyle = labelColor;
  ctx.fillText(node.label, centerX, labelY);

  let textBoundsY = bounds.y + bounds.height / 2 - 18;
  let textBoundsHeight = 36;

  if (node.sublabel) {
    applyFont(ctx, { size: sublabelFontSize, weight: 500, family: bodyFont });
    ctx.fillStyle = sublabelColor;
    ctx.fillText(node.sublabel, centerX, labelY + labelToSublabelGap);
    textBoundsY = bounds.y + bounds.height / 2 - 24;
    textBoundsHeight = 56;
  }

  if (node.sublabel2) {
    applyFont(ctx, { size: sublabel2FontSize, weight: 500, family: bodyFont });
    ctx.fillStyle = sublabel2Color;
    const sublabel2Y = node.sublabel
      ? labelY + labelToSublabelGap + sublabelToSublabel2Gap
      : labelY + labelToSublabelGap;
    ctx.fillText(node.sublabel2, centerX, sublabel2Y);
    textBoundsY = bounds.y + bounds.height / 2 - 30;
    textBoundsHeight = 72;
  }

  // Render badge pill.
  if (hasBadge && node.badgeText) {
    if (badgePosition === 'inside-top') {
      // Inside the node at the top, above the label text.
      const badgeCenterY = bounds.y + BADGE_PILL_HEIGHT / 2 + 8;
      renderBadgePill(
        ctx,
        centerX,
        badgeCenterY,
        node.badgeText,
        badgeColor,
        badgeBackground,
        monoFont,
      );
    } else {
      // 'top': floating above the node, centered horizontally.
      const badgeCenterY = bounds.y - BADGE_PILL_HEIGHT / 2 - 4;
      renderBadgePill(
        ctx,
        centerX,
        badgeCenterY,
        node.badgeText,
        badgeColor,
        badgeBackground,
        monoFont,
      );
    }
  }

  ctx.restore();

  const effectiveBg =
    fillOpacity < 1 ? blendColorWithOpacity(fillColor, theme.background, fillOpacity) : fillColor;

  return [
    {
      id: `flow-node-${node.id}`,
      kind: 'flow-node',
      bounds,
      foregroundColor: labelColor,
      backgroundColor: effectiveBg,
    },
    {
      id: `flow-node-${node.id}-label`,
      kind: 'text',
      bounds: {
        x: bounds.x + 8,
        y: textBoundsY,
        width: bounds.width - 16,
        height: textBoundsHeight,
      },
      foregroundColor: labelColor,
      backgroundColor: effectiveBg,
    },
  ];
}
