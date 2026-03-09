import type { Rect } from '../renderer.js';
import type { Element, StackLayoutConfig } from '../spec.schema.js';
import { estimateElementHeight, estimateElementWidth } from './estimates.js';
import type { LayoutResult } from './types.js';

export function computeStackLayout(
  elements: Element[],
  config: StackLayoutConfig,
  safeFrame: Rect,
): LayoutResult {
  const placeable = elements.filter((element) => element.type !== 'connection');
  const positions = new Map<string, Rect>();

  if (placeable.length === 0) {
    return { positions };
  }

  const gap = config.gap;

  if (config.direction === 'vertical') {
    const estimatedHeights = placeable.map((element) => estimateElementHeight(element));
    const totalEstimated = estimatedHeights.reduce((sum, value) => sum + value, 0);
    const available = Math.max(0, safeFrame.height - gap * (placeable.length - 1));
    const scale = totalEstimated > 0 ? Math.min(1, available / totalEstimated) : 1;

    let y = safeFrame.y;

    for (const [index, element] of placeable.entries()) {
      const stretched = config.alignment === 'stretch';
      const width = stretched
        ? safeFrame.width
        : Math.min(safeFrame.width, Math.floor(estimateElementWidth(element)));
      const height = Math.max(48, Math.floor(estimatedHeights[index] * scale));

      let x = safeFrame.x;
      if (!stretched) {
        if (config.alignment === 'center') {
          x = safeFrame.x + Math.floor((safeFrame.width - width) / 2);
        } else if (config.alignment === 'end') {
          x = safeFrame.x + safeFrame.width - width;
        }
      }

      positions.set(element.id, { x, y, width, height });
      y += height + gap;
    }

    return { positions };
  }

  const estimatedWidths = placeable.map((element) => estimateElementWidth(element));
  const totalEstimated = estimatedWidths.reduce((sum, value) => sum + value, 0);
  const available = Math.max(0, safeFrame.width - gap * (placeable.length - 1));
  const scale = totalEstimated > 0 ? Math.min(1, available / totalEstimated) : 1;

  let x = safeFrame.x;
  for (const [index, element] of placeable.entries()) {
    const stretched = config.alignment === 'stretch';
    const height = stretched
      ? safeFrame.height
      : Math.min(safeFrame.height, Math.floor(estimateElementHeight(element)));
    const width = Math.max(64, Math.floor(estimatedWidths[index] * scale));

    let y = safeFrame.y;
    if (!stretched) {
      if (config.alignment === 'center') {
        y = safeFrame.y + Math.floor((safeFrame.height - height) / 2);
      } else if (config.alignment === 'end') {
        y = safeFrame.y + safeFrame.height - height;
      }
    }

    positions.set(element.id, { x, y, width, height });
    x += width + gap;
  }

  return { positions };
}
