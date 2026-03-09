import ELK, { type ElkNode } from 'elkjs';
import type { Rect } from '../renderer.js';
import type {
  AutoLayoutConfig,
  ConnectionElement,
  Element,
  FlowNodeElement,
  StackLayoutConfig,
} from '../spec.schema.js';
import { computeStackLayout } from './stack.js';
import type { EdgeRoute, ElkLayoutResult, LayoutResult } from './types.js';

type LayoutTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function estimateFlowNodeSize(node: FlowNodeElement): { width: number; height: number } {
  if (node.width && node.height) {
    return { width: node.width, height: node.height };
  }

  if (node.width) {
    return {
      width: node.width,
      height: node.shape === 'diamond' || node.shape === 'circle' ? node.width : 60,
    };
  }

  if (node.height) {
    return {
      width: node.shape === 'diamond' || node.shape === 'circle' ? node.height : 160,
      height: node.height,
    };
  }

  switch (node.shape) {
    case 'diamond':
    case 'circle':
      return { width: 100, height: 100 };
    case 'pill':
      return { width: 180, height: 56 };
    case 'cylinder':
      return { width: 140, height: 92 };
    case 'parallelogram':
      return { width: 180, height: 72 };
    default:
      return { width: 170, height: 64 };
  }
}

function splitLayoutFrames(
  safeFrame: Rect,
  direction: AutoLayoutConfig['direction'],
  hasAuxiliary: boolean,
): { flowFrame: Rect; auxiliaryFrame?: Rect } {
  if (!hasAuxiliary) {
    return { flowFrame: safeFrame };
  }

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const gap = Math.min(
    32,
    Math.max(16, Math.floor(Math.min(safeFrame.width, safeFrame.height) * 0.03)),
  );

  if (isHorizontal) {
    const flowWidth = Math.max(120, Math.floor(safeFrame.width * 0.7) - Math.floor(gap / 2));
    const auxiliaryWidth = Math.max(120, safeFrame.width - flowWidth - gap);

    return {
      flowFrame: {
        x: safeFrame.x,
        y: safeFrame.y,
        width: flowWidth,
        height: safeFrame.height,
      },
      auxiliaryFrame: {
        x: safeFrame.x + flowWidth + gap,
        y: safeFrame.y,
        width: auxiliaryWidth,
        height: safeFrame.height,
      },
    };
  }

  const flowHeight = Math.max(120, Math.floor(safeFrame.height * 0.7) - Math.floor(gap / 2));
  const auxiliaryHeight = Math.max(120, safeFrame.height - flowHeight - gap);

  return {
    flowFrame: {
      x: safeFrame.x,
      y: safeFrame.y,
      width: safeFrame.width,
      height: flowHeight,
    },
    auxiliaryFrame: {
      x: safeFrame.x,
      y: safeFrame.y + flowHeight + gap,
      width: safeFrame.width,
      height: auxiliaryHeight,
    },
  };
}

function computeBounds(
  nodes: Array<{ x: number; y: number; width: number; height: number }>,
): Bounds {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return { minX, minY, maxX, maxY };
}

function computeTransform(bounds: Bounds, targetFrame: Rect): LayoutTransform {
  const padding = 8;
  const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
  const graphHeight = Math.max(1, bounds.maxY - bounds.minY);
  const usableWidth = Math.max(1, targetFrame.width - padding * 2);
  const usableHeight = Math.max(1, targetFrame.height - padding * 2);
  const scale = Math.min(usableWidth / graphWidth, usableHeight / graphHeight, 1);

  const offsetX =
    targetFrame.x + padding + (usableWidth - graphWidth * scale) / 2 - bounds.minX * scale;
  const offsetY =
    targetFrame.y + padding + (usableHeight - graphHeight * scale) / 2 - bounds.minY * scale;

  return { scale, offsetX, offsetY };
}

function transformPoint(
  point: { x: number; y: number },
  transform: LayoutTransform,
): { x: number; y: number } {
  return {
    x: Math.round(point.x * transform.scale + transform.offsetX),
    y: Math.round(point.y * transform.scale + transform.offsetY),
  };
}

function toLayoutRect(
  node: { x: number; y: number; width: number; height: number },
  transform: LayoutTransform,
): Rect {
  return {
    x: Math.round(node.x * transform.scale + transform.offsetX),
    y: Math.round(node.y * transform.scale + transform.offsetY),
    width: Math.max(36, Math.round(node.width * transform.scale)),
    height: Math.max(28, Math.round(node.height * transform.scale)),
  };
}

function routeKey(connection: ConnectionElement): string {
  return `${connection.from}-${connection.to}`;
}

function edgeRoutingToElk(edgeRouting: AutoLayoutConfig['edgeRouting']): string {
  switch (edgeRouting) {
    case 'orthogonal':
      return 'ORTHOGONAL';
    case 'spline':
      return 'SPLINES';
    default:
      return 'POLYLINE';
  }
}

function algorithmToElk(algorithm: AutoLayoutConfig['algorithm']): string {
  switch (algorithm) {
    case 'stress':
      return 'stress';
    case 'force':
      return 'force';
    case 'radial':
      return 'radial';
    case 'box':
      return 'rectpacking';
    default:
      return 'layered';
  }
}

function directionToElk(direction: AutoLayoutConfig['direction']): string {
  switch (direction) {
    case 'BT':
      return 'UP';
    case 'LR':
      return 'RIGHT';
    case 'RL':
      return 'LEFT';
    default:
      return 'DOWN';
  }
}

function fallbackForNoFlowNodes(nonFlow: Element[], safeFrame: Rect): LayoutResult {
  const fallbackConfig: StackLayoutConfig = {
    mode: 'stack',
    direction: 'vertical',
    gap: 24,
    alignment: 'stretch',
  };
  return computeStackLayout(nonFlow, fallbackConfig, safeFrame);
}

export async function computeElkLayout(
  elements: Element[],
  config: AutoLayoutConfig,
  safeFrame: Rect,
): Promise<ElkLayoutResult> {
  const positions = new Map<string, Rect>();
  const edgeRoutes = new Map<string, EdgeRoute>();

  const flowNodes = elements.filter(
    (element): element is FlowNodeElement => element.type === 'flow-node',
  );
  const connections = elements.filter(
    (element): element is ConnectionElement => element.type === 'connection',
  );
  const nonFlow = elements.filter(
    (element) => element.type !== 'flow-node' && element.type !== 'connection',
  );

  if (flowNodes.length === 0) {
    return fallbackForNoFlowNodes(nonFlow, safeFrame);
  }

  const { flowFrame, auxiliaryFrame } = splitLayoutFrames(
    safeFrame,
    config.direction,
    nonFlow.length > 0,
  );

  const flowNodeIds = new Set(flowNodes.map((node) => node.id));
  const elkNodeSizes = new Map<string, { width: number; height: number }>();

  for (const node of flowNodes) {
    elkNodeSizes.set(node.id, estimateFlowNodeSize(node));
  }

  const edgeIdToRouteKey = new Map<string, string>();

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': algorithmToElk(config.algorithm),
      'elk.direction': directionToElk(config.direction),
      'elk.spacing.nodeNode': String(config.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(config.rankSpacing),
      'elk.edgeRouting': edgeRoutingToElk(config.edgeRouting),
      ...(config.aspectRatio ? { 'elk.aspectRatio': String(config.aspectRatio) } : {}),
      ...(config.algorithm === 'stress'
        ? { 'elk.stress.desiredEdgeLength': String(config.rankSpacing + config.nodeSpacing) }
        : {}),
    },
    children: flowNodes.map((node) => {
      const size = elkNodeSizes.get(node.id) ?? { width: 160, height: 60 };
      return {
        id: node.id,
        width: size.width,
        height: size.height,
      };
    }),
    edges: connections
      .filter((connection) => flowNodeIds.has(connection.from) && flowNodeIds.has(connection.to))
      .map((connection, index) => {
        const id = `edge-${index}-${connection.from}-${connection.to}`;
        edgeIdToRouteKey.set(id, routeKey(connection));
        return {
          id,
          sources: [connection.from],
          targets: [connection.to],
        };
      }),
  };

  const elk = new ELK.default();
  const result = await elk.layout(elkGraph);

  const laidOutNodes = (result.children ?? []).filter(
    (node): node is { id: string; x: number; y: number; width: number; height: number } =>
      typeof node.id === 'string' &&
      typeof node.x === 'number' &&
      typeof node.y === 'number' &&
      typeof node.width === 'number' &&
      typeof node.height === 'number',
  );

  if (laidOutNodes.length > 0) {
    const bounds = computeBounds(laidOutNodes);
    const transform = computeTransform(bounds, flowFrame);

    for (const node of laidOutNodes) {
      positions.set(node.id, toLayoutRect(node, transform));
    }

    for (const edge of result.edges ?? []) {
      const route = edgeIdToRouteKey.get(edge.id ?? '');
      if (!route) {
        continue;
      }

      const points: Array<{ x: number; y: number }> = [];
      for (const section of edge.sections ?? []) {
        if (section.startPoint) {
          points.push(transformPoint(section.startPoint, transform));
        }
        for (const bend of section.bendPoints ?? []) {
          points.push(transformPoint(bend, transform));
        }
        if (section.endPoint) {
          points.push(transformPoint(section.endPoint, transform));
        }
      }

      const deduped = points.filter((point, index, all) => {
        if (index === 0) {
          return true;
        }
        const prev = all[index - 1];
        return prev.x !== point.x || prev.y !== point.y;
      });

      if (deduped.length >= 2) {
        edgeRoutes.set(route, { points: deduped });
      }
    }
  }

  if (nonFlow.length > 0) {
    const stackConfig: StackLayoutConfig = {
      mode: 'stack',
      direction: config.direction === 'LR' || config.direction === 'RL' ? 'vertical' : 'horizontal',
      gap: 20,
      alignment: 'stretch',
    };

    const supplemental = computeStackLayout(nonFlow, stackConfig, auxiliaryFrame ?? safeFrame);
    for (const [id, rect] of supplemental.positions) {
      positions.set(id, rect);
    }
  }

  return {
    positions,
    edgeRoutes,
  };
}
