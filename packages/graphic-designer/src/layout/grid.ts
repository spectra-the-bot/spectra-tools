import type { Rect } from '../renderer.js';
import type { Element, GridLayoutConfig } from '../spec.schema.js';
import { estimateElementHeight } from './estimates.js';
import type { LayoutResult } from './types.js';

export function computeGridLayout(
  elements: Element[],
  config: GridLayoutConfig,
  safeFrame: Rect,
): LayoutResult {
  const placeable = elements.filter((element) => element.type !== 'connection');
  const positions = new Map<string, Rect>();

  if (placeable.length === 0) {
    return { positions };
  }

  const columns = Math.max(1, Math.min(config.columns, placeable.length));
  const rows = Math.ceil(placeable.length / columns);
  const gap = config.gap;

  const availableWidth = Math.max(0, safeFrame.width - gap * (columns - 1));
  const cellWidth = Math.floor(availableWidth / columns);

  const rowElements: Element[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const start = row * columns;
    rowElements.push(placeable.slice(start, start + columns));
  }

  const equalRowHeight = Math.floor((safeFrame.height - gap * (rows - 1)) / rows);
  const estimatedRowHeights = rowElements.map((row) => {
    if (config.equalHeight) {
      return equalRowHeight;
    }
    return Math.max(...row.map((element) => estimateElementHeight(element)));
  });

  const estimatedTotalHeight =
    estimatedRowHeights.reduce((sum, height) => sum + height, 0) + gap * (rows - 1);
  const availableHeight = Math.max(0, safeFrame.height);
  const scale = estimatedTotalHeight > 0 ? Math.min(1, availableHeight / estimatedTotalHeight) : 1;

  const rowHeights = estimatedRowHeights.map((height) => Math.max(48, Math.floor(height * scale)));

  let y = safeFrame.y;
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    const rowHeight = rowHeights[row];

    for (let col = 0; col < rowElements[row].length; col += 1) {
      const element = placeable[index];
      const x = safeFrame.x + col * (cellWidth + gap);

      positions.set(element.id, {
        x,
        y,
        width: cellWidth,
        height: rowHeight,
      });

      index += 1;
    }

    y += rowHeight + gap;
  }

  return { positions };
}
