import type { Rect } from '../renderer.js';
import type { Element, LayoutConfig } from '../spec.schema.js';
import { computeElkLayout } from './elk.js';
import { computeEllipseLayout } from './ellipse.js';
import { computeGridLayout } from './grid.js';
import { computeStackLayout } from './stack.js';
import type { LayoutResult } from './types.js';

export type { EdgeRoute, ElkLayoutResult, LayoutResult } from './types.js';

function defaultManualSize(total: number, safeFrame: Rect): Rect {
  return {
    x: safeFrame.x,
    y: safeFrame.y,
    width: Math.floor(safeFrame.width / 2),
    height: Math.floor(safeFrame.height / Math.max(1, total)),
  };
}

function computeManualLayout(
  elements: Element[],
  layout: LayoutConfig,
  safeFrame: Rect,
): LayoutResult {
  const positions = new Map<string, Rect>();
  const placeable = elements.filter((element) => element.type !== 'connection');

  if (layout.mode !== 'manual') {
    return { positions };
  }

  const fallbackGrid = computeGridLayout(
    placeable,
    { mode: 'grid', columns: 3, gap: 24, equalHeight: false },
    safeFrame,
  );

  for (const element of placeable) {
    const manual = layout.positions[element.id];
    if (!manual) {
      const fallbackRect = fallbackGrid.positions.get(element.id);
      if (fallbackRect) {
        positions.set(element.id, fallbackRect);
      }
      continue;
    }

    const fallback = defaultManualSize(placeable.length, safeFrame);
    positions.set(element.id, {
      x: manual.x,
      y: manual.y,
      width: manual.width ?? fallback.width,
      height: manual.height ?? fallback.height,
    });
  }

  return { positions };
}

export async function computeLayout(
  elements: Element[],
  layout: LayoutConfig,
  safeFrame: Rect,
): Promise<LayoutResult> {
  switch (layout.mode) {
    case 'auto':
      return computeElkLayout(elements, layout, safeFrame);
    case 'grid':
      return computeGridLayout(elements, layout, safeFrame);
    case 'stack':
      return computeStackLayout(elements, layout, safeFrame);
    case 'ellipse':
      return computeEllipseLayout(elements, layout, safeFrame);
    case 'manual':
      return computeManualLayout(elements, layout, safeFrame);
    default:
      return computeGridLayout(
        elements,
        { mode: 'grid', columns: 3, gap: 24, equalHeight: false },
        safeFrame,
      );
  }
}
