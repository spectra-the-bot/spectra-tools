import type { SKRSContext2D } from '@napi-rs/canvas';
import type { Rect, RenderedElement } from '../renderer.js';
import type { FlowNodeElement, Theme } from '../spec.schema.js';
import {
  drawCircle,
  drawCylinder,
  drawDiamond,
  drawParallelogram,
  drawPill,
  drawRoundedRect,
} from '../primitives/shapes.js';
import { applyFont, resolveFont } from '../primitives/text.js';

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

  ctx.save();
  ctx.globalAlpha = node.opacity;
  ctx.lineWidth = borderWidth;

  switch (node.shape) {
    case 'box':
      drawRoundedRect(ctx, bounds, 0, fillColor, borderColor);
      break;
    case 'rounded-box':
      drawRoundedRect(ctx, bounds, cornerRadius, fillColor, borderColor);
      break;
    case 'diamond':
      drawDiamond(ctx, bounds, fillColor, borderColor);
      break;
    case 'circle': {
      const radius = Math.min(bounds.width, bounds.height) / 2;
      drawCircle(
        ctx,
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        radius,
        fillColor,
        borderColor,
      );
      break;
    }
    case 'pill':
      drawPill(ctx, bounds, fillColor, borderColor);
      break;
    case 'cylinder':
      drawCylinder(ctx, bounds, fillColor, borderColor);
      break;
    case 'parallelogram':
      drawParallelogram(ctx, bounds, fillColor, borderColor);
      break;
  }

  const headingFont = resolveFont(theme.fonts.heading, 'heading');
  const bodyFont = resolveFont(theme.fonts.body, 'body');
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const labelY = node.sublabel ? centerY - Math.max(4, labelFontSize * 0.2) : centerY + labelFontSize * 0.3;

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

  return [
    {
      id: `flow-node-${node.id}`,
      kind: 'flow-node',
      bounds,
      foregroundColor: labelColor,
      backgroundColor: fillColor,
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
      backgroundColor: fillColor,
    },
  ];
}
