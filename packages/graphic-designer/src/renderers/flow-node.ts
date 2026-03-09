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
import { blendColorWithOpacity } from '../utils/color.js';

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

  ctx.save();
  ctx.lineWidth = borderWidth;

  if (fillOpacity < 1) {
    // Two-pass rendering: fill at reduced opacity, then stroke at full node
    // opacity. Pass 1 draws the fill without a border. Pass 2 re-draws the
    // shape with a transparent fill so only the stroke is visible.
    ctx.globalAlpha = node.opacity * fillOpacity;
    drawNodeShape(ctx, node.shape, bounds, fillColor, undefined, cornerRadius);

    ctx.globalAlpha = node.opacity;
    drawNodeShape(ctx, node.shape, bounds, 'rgba(0,0,0,0)', borderColor, cornerRadius);
  } else {
    ctx.globalAlpha = node.opacity;
    drawNodeShape(ctx, node.shape, bounds, fillColor, borderColor, cornerRadius);
  }

  const headingFont = resolveFont(theme.fonts.heading, 'heading');
  const bodyFont = resolveFont(theme.fonts.body, 'body');
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const labelY = node.sublabel
    ? centerY - Math.max(4, labelFontSize * 0.2)
    : centerY + labelFontSize * 0.3;

  ctx.textAlign = 'center';
  applyFont(ctx, { size: labelFontSize, weight: 700, family: headingFont });
  ctx.fillStyle = labelColor;
  ctx.fillText(node.label, centerX, labelY);

  let textBoundsY = bounds.y + bounds.height / 2 - 18;
  let textBoundsHeight = 36;

  if (node.sublabel) {
    const sublabelFontSize = Math.max(12, Math.round(labelFontSize * 0.68));
    applyFont(ctx, { size: sublabelFontSize, weight: 500, family: bodyFont });
    ctx.fillStyle = sublabelColor;
    ctx.fillText(node.sublabel, centerX, labelY + Math.max(20, sublabelFontSize + 6));
    textBoundsY = bounds.y + bounds.height / 2 - 24;
    textBoundsHeight = 56;
  }

  ctx.restore();

  // When fillOpacity < 1 the canvas background bleeds through, so the
  // effective background colour for QA contrast checks is the fill blended
  // with the theme background at the given fillOpacity.
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
