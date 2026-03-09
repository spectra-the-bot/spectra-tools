import { parseDesignSpec, type DesignSpec, type FlowNodeElement } from '../spec.schema.js';

const FLOW_NODE_SHAPES: ReadonlySet<FlowNodeElement['shape']> = new Set([
  'box',
  'rounded-box',
  'diamond',
  'circle',
  'pill',
  'cylinder',
  'parallelogram',
]);

function parseNodeToken(token: string, fallbackShape: FlowNodeElement['shape']): {
  name: string;
  shape: FlowNodeElement['shape'];
} {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Flowchart nodes cannot include empty values.');
  }

  const shapeDelimiter = trimmed.lastIndexOf(':');
  if (shapeDelimiter <= 0 || shapeDelimiter >= trimmed.length - 1) {
    return {
      name: trimmed,
      shape: fallbackShape,
    };
  }

  const name = trimmed.slice(0, shapeDelimiter).trim();
  const shapeCandidate = trimmed.slice(shapeDelimiter + 1).trim() as FlowNodeElement['shape'];

  if (!name) {
    throw new Error(`Invalid node token "${token}".`);
  }

  if (!FLOW_NODE_SHAPES.has(shapeCandidate)) {
    return {
      name: trimmed,
      shape: fallbackShape,
    };
  }

  return {
    name,
    shape: shapeCandidate,
  };
}

function parseEdgeToken(token: string): { from: string; to: string; label?: string } {
  const trimmed = token.trim();
  const match = /^(.*?)\s*->\s*([^:]+?)(?::(.*))?$/u.exec(trimmed);

  if (!match) {
    throw new Error(`Invalid flowchart edge "${token}". Expected "From->To" or "From->To:label".`);
  }

  const [, rawFrom, rawTo, rawLabel] = match;
  const from = rawFrom.trim();
  const to = rawTo.trim();
  const label = rawLabel?.trim();

  if (!from || !to) {
    throw new Error(`Invalid flowchart edge "${token}".`);
  }

  return {
    from,
    to,
    ...(label ? { label } : {}),
  };
}

export function buildFlowchartSpec(options: {
  nodes: string[];
  edges: string[];
  title?: string;
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  algorithm?: 'layered' | 'stress' | 'force' | 'radial' | 'box';
  theme?: string;
  nodeShape?: string;
  width?: number;
  height?: number;
}): DesignSpec {
  const defaultShape = (options.nodeShape ?? 'rounded-box') as FlowNodeElement['shape'];
  if (!FLOW_NODE_SHAPES.has(defaultShape)) {
    throw new Error(`Invalid node shape "${options.nodeShape}".`);
  }

  const nodeIds = new Map<string, string>();
  const flowNodes = options.nodes.map((nodeToken, index) => {
    const parsed = parseNodeToken(nodeToken, defaultShape);
    if (nodeIds.has(parsed.name)) {
      throw new Error(`Duplicate flowchart node "${parsed.name}".`);
    }

    const id = `node-${index + 1}`;
    nodeIds.set(parsed.name, id);

    return {
      type: 'flow-node',
      id,
      shape: parsed.shape,
      label: parsed.name,
    };
  });

  const connections = options.edges.map((edgeToken) => {
    const edge = parseEdgeToken(edgeToken);
    const from = nodeIds.get(edge.from);
    const to = nodeIds.get(edge.to);

    if (!from || !to) {
      throw new Error(`Edge "${edgeToken}" references unknown nodes.`);
    }

    return {
      type: 'connection',
      from,
      to,
      arrow: 'end',
      ...(edge.label ? { label: edge.label } : {}),
    };
  });

  return parseDesignSpec({
    version: 2,
    ...(options.width || options.height
      ? {
          canvas: {
            ...(options.width ? { width: options.width } : {}),
            ...(options.height ? { height: options.height } : {}),
          },
        }
      : {}),
    theme: options.theme ?? 'dark',
    ...(options.title ? { header: { title: options.title } } : {}),
    layout: {
      mode: 'auto',
      algorithm: options.algorithm ?? 'layered',
      direction: options.direction ?? 'TB',
    },
    elements: [...flowNodes, ...connections],
  });
}
