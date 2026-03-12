import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli } from '../cli.js';
import {
  type GraphSpec,
  graphSpecSchema,
  graphSpecToDesignSpec,
  parseSpecInput,
} from '../spec.schema.js';

type CliResult = {
  output: string;
  exitCode: number;
};

async function runCli(argv: string[]): Promise<CliResult> {
  let output = '';
  let exitCode = 0;

  await cli.serve(argv, {
    stdout: (chunk) => {
      output += chunk;
    },
    exit: (code) => {
      exitCode = code;
    },
  });

  return { output, exitCode };
}

describe('graphSpecSchema', () => {
  it('accepts minimal nodes/edges input', () => {
    const input = {
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const result = graphSpecSchema.parse(input);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('accepts nodes without edges', () => {
    const input = {
      nodes: [{ id: 'a', label: 'Node A' }],
    };
    const result = graphSpecSchema.parse(input);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('accepts edges with optional label', () => {
    const input = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'connects' }],
    };
    const result = graphSpecSchema.parse(input);
    expect(result.edges[0].label).toBe('connects');
  });

  it('accepts nodes with optional shape', () => {
    const input = {
      nodes: [{ id: 'a', label: 'A', shape: 'diamond' }],
      edges: [],
    };
    const result = graphSpecSchema.parse(input);
    expect(result.nodes[0].shape).toBe('diamond');
  });

  it('rejects empty nodes array', () => {
    expect(() => graphSpecSchema.parse({ nodes: [], edges: [] })).toThrow();
  });

  it('rejects unknown top-level keys', () => {
    expect(() =>
      graphSpecSchema.parse({
        nodes: [{ id: 'a', label: 'A' }],
        edges: [],
        extra: true,
      }),
    ).toThrow();
  });
});

describe('graphSpecToDesignSpec', () => {
  it('converts graph spec to design spec with auto layout', () => {
    const graph: GraphSpec = {
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const spec = graphSpecToDesignSpec(graph);
    expect(spec.layout.mode).toBe('auto');
    expect(spec.elements).toHaveLength(3);
    expect(spec.elements[0].type).toBe('flow-node');
    expect(spec.elements[2].type).toBe('connection');
  });
});

describe('parseSpecInput', () => {
  it('parses standard DesignSpec input', () => {
    const input = {
      version: 2,
      elements: [{ type: 'card', id: 'c1', title: 'Hello', body: 'World' }],
    };
    const spec = parseSpecInput(input);
    expect(spec.elements).toHaveLength(1);
  });

  it('parses graph spec with nodes/edges', () => {
    const input = {
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const spec = parseSpecInput(input);
    expect(spec.elements).toHaveLength(3);
    expect(spec.layout.mode).toBe('auto');
  });

  it('throws on completely invalid input', () => {
    expect(() => parseSpecInput({ invalid: true })).toThrow();
  });
});

describe('draw command with graph spec', () => {
  it('renders a graph spec with nodes and edges via draw command', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'graphic-designer-draw-graph-'));
    const specPath = join(tmp, 'graph.json');
    const outDir = join(tmp, 'out');

    const graphSpec = {
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };

    await writeFile(specPath, JSON.stringify(graphSpec), 'utf8');

    const result = await runCli(['draw', specPath, '--output', outDir, '--json']);

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.output) as {
      imagePath: string;
      layoutMode: string;
      qa: { pass: boolean };
    };

    expect(payload.layoutMode).toBe('auto');
    expect(payload.imagePath).toContain(outDir);
  });

  it('rejects a completely invalid spec with appropriate error', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'graphic-designer-draw-invalid-'));
    const specPath = join(tmp, 'bad.json');
    const outDir = join(tmp, 'out');

    await writeFile(specPath, JSON.stringify({ garbage: true }), 'utf8');

    const result = await runCli(['draw', specPath, '--output', outDir, '--json']);

    expect(result.exitCode).toBe(1);
  });
});
