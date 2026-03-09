import type { SKRSContext2D } from '@napi-rs/canvas';
import { drawArrow, drawLine } from '../primitives/lines.js';
import { drawCircle, drawEllipse, drawRoundedRect } from '../primitives/shapes.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { ShapeElement, Theme } from '../spec.schema.js';

export function renderShapeElement(
  ctx: SKRSContext2D,
  shape: ShapeElement,
  bounds: Rect,
  theme: Theme,
): RenderedElement[] {
  const fill = shape.fill ?? theme.surfaceMuted;
  const stroke = shape.stroke ?? theme.border;

  ctx.lineWidth = shape.strokeWidth;

  switch (shape.shape) {
    case 'rectangle':
      drawRoundedRect(ctx, bounds, 0, fill, stroke);
      break;
    case 'rounded-rectangle':
      drawRoundedRect(ctx, bounds, 14, fill, stroke);
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
    case 'ellipse':
      drawEllipse(ctx, bounds, fill, stroke);
      break;
    case 'line':
      drawLine(
        ctx,
        { x: bounds.x, y: bounds.y + bounds.height / 2 },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
        { color: stroke, width: shape.strokeWidth },
      );
      break;
    case 'arrow':
      drawArrow(
        ctx,
        { x: bounds.x, y: bounds.y + bounds.height / 2 },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
        'end',
        { color: stroke, width: shape.strokeWidth, headSize: Math.max(8, shape.strokeWidth * 3) },
      );
      break;
  }

  return [
    {
      id: `shape-${shape.id}`,
      kind: 'shape',
      bounds,
      foregroundColor: stroke,
      backgroundColor: fill,
    },
  ];
}
