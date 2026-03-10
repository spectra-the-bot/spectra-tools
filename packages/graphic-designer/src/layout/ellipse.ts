import type { Rect } from '../renderer.js';
import type { Element, EllipseLayoutConfig } from '../spec.schema.js';
import { estimateElementHeight, estimateElementWidth } from './estimates.js';
import type { LayoutResult } from './types.js';

function clampDimension(estimated: number, max: number): number {
  return Math.max(1, Math.min(max, Math.floor(estimated)));
}

export function computeEllipseLayout(
  elements: Element[],
  config: EllipseLayoutConfig,
  safeFrame: Rect,
): LayoutResult {
  const placeable = elements.filter((element) => element.type !== 'connection');
  const positions = new Map<string, Rect>();

  if (placeable.length === 0) {
    return { positions };
  }

  const cx = config.cx ?? safeFrame.x + safeFrame.width / 2;
  const cy = config.cy ?? safeFrame.y + safeFrame.height / 2;
  const stepDegrees = 360 / placeable.length;

  for (const [index, element] of placeable.entries()) {
    const angleRadians = ((config.startAngle + index * stepDegrees) * Math.PI) / 180;
    const centerX = cx + config.rx * Math.cos(angleRadians);
    const centerY = cy + config.ry * Math.sin(angleRadians);
    const width = clampDimension(estimateElementWidth(element), safeFrame.width);
    const height = clampDimension(estimateElementHeight(element), safeFrame.height);

    positions.set(element.id, {
      x: Math.round(centerX - width / 2),
      y: Math.round(centerY - height / 2),
      width,
      height,
    });
  }

  return { positions };
}
