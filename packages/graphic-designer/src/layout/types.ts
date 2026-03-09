import type { Rect } from '../renderer.js';

export type EdgeRoute = {
  points: Array<{ x: number; y: number }>;
};

export type LayoutResult = {
  positions: Map<string, Rect>;
  canvasSize?: { width: number; height: number };
};

export type ElkLayoutResult = LayoutResult & {
  edgeRoutes?: Map<string, EdgeRoute>;
};
