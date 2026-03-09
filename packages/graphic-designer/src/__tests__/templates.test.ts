import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { runQa } from '../qa.js';
import { renderDesign, writeRenderArtifacts } from '../renderer.js';
import {
  buildCardsSpec,
  buildCodeSpec,
  buildFlowchartSpec,
  buildTerminalSpec,
} from '../templates/index.js';

describe('template builders', () => {
  it('builds a valid flowchart spec with node shapes and edge labels', () => {
    const spec = buildFlowchartSpec({
      nodes: ['Start', 'Process:rounded-box', 'Decision:diamond', 'End'],
      edges: [
        'Start->Process',
        'Process->Decision',
        'Decision->End:yes',
        'Decision->Process:retry',
      ],
      title: 'CI/CD Pipeline',
      direction: 'LR',
      algorithm: 'stress',
      theme: 'dracula',
    });

    expect(spec.header?.title).toBe('CI/CD Pipeline');
    expect(spec.layout.mode).toBe('auto');
    expect(spec.layout.direction).toBe('LR');
    expect(spec.layout.algorithm).toBe('stress');

    const flowNodes = spec.elements.filter((el) => el.type === 'flow-node');
    const connections = spec.elements.filter((el) => el.type === 'connection');

    expect(flowNodes).toHaveLength(4);
    expect(connections).toHaveLength(4);

    const decision = flowNodes.find((el) => el.label === 'Decision');
    expect(decision?.shape).toBe('diamond');

    const retry = connections.find((el) => el.label === 'retry');
    const yes = connections.find((el) => el.label === 'yes');
    expect(retry?.arrow).toBe('end');
    expect(yes?.arrow).toBe('end');
  });

  it('builds a valid code screenshot spec', () => {
    const spec = buildCodeSpec({
      code: 'const x = 1;\nconsole.log(x);',
      language: 'typescript',
      title: 'main.ts',
      showLineNumbers: true,
      highlightLines: [2],
      startLine: 10,
      theme: 'dracula',
    });

    expect(spec.canvas.width).toBe(800);
    expect(spec.canvas.height).toBe(500);
    expect(spec.layout.mode).toBe('stack');

    const block = spec.elements.find((el) => el.type === 'code-block');
    expect(block).toBeDefined();
    expect(block?.showLineNumbers).toBe(true);
    expect(block?.highlightLines).toEqual([2]);
    expect(block?.startLine).toBe(10);
    expect(block?.style?.windowControls).toBe('macos');
    expect(block?.style?.scale).toBe(2);
  });

  it('renders code template at 2x scale by default', async () => {
    const spec = buildCodeSpec({
      code: 'console.log("hello");',
      language: 'typescript',
    });

    const rendered = await renderDesign(spec, { generatorVersion: 'template-scale-test' });
    const metadata = await sharp(rendered.png).metadata();

    expect(rendered.metadata.canvas.scale).toBe(2);
    expect(metadata.width).toBe(spec.canvas.width * 2);
    expect(metadata.height).toBe(spec.canvas.height * 2);
  });

  it('formats terminal content from command + output', () => {
    const spec = buildTerminalSpec({
      command: 'npm run build',
      output: 'Build complete in 2.3s',
      prompt: '$ ',
      title: 'Build',
      windowControls: 'macos',
    });

    expect(spec.canvas.width).toBe(800);
    expect(spec.canvas.height).toBe(400);

    const terminal = spec.elements.find((el) => el.type === 'terminal');
    expect(terminal).toBeDefined();
    expect(terminal?.content).toBe('$ npm run build\n\nBuild complete in 2.3s');
    expect(terminal?.showPrompt).toBe(false);
    expect(terminal?.style?.windowControls).toBe('macos');
    expect(terminal?.style?.scale).toBe(2);
  });

  it('auto-detects card columns when not explicitly provided', () => {
    const spec = buildCardsSpec({
      cards: [
        { title: 'Commits', body: '148 total', metric: '148', badge: 'git' },
        { title: 'PRs', body: '129 merged', metric: '129' },
        { title: 'Issues', body: '12 open', metric: '12' },
        { title: 'Deploys', body: '7 this week', metric: '7' },
      ],
      title: 'Pipeline Stats',
      subtitle: 'Weekly summary',
    });

    expect(spec.layout.mode).toBe('grid');
    expect(spec.layout.columns).toBe(2);
    expect(spec.header?.title).toBe('Pipeline Stats');
    expect(spec.header?.subtitle).toBe('Weekly summary');

    const cards = spec.elements.filter((el) => el.type === 'card');
    expect(cards).toHaveLength(4);
    expect(cards[0]?.id).toBe('card-1');
  });

  it('template specs pass through render + QA pipeline without errors', async () => {
    const specs = [
      buildFlowchartSpec({
        nodes: ['Start', 'Process', 'End'],
        edges: ['Start->Process', 'Process->End'],
      }),
      buildCodeSpec({
        code: 'const a = 1;\nconsole.log(a);',
        language: 'typescript',
      }),
      buildTerminalSpec({
        content: '$ pnpm test\n\nDone in 2.1s',
      }),
      buildCardsSpec({
        cards: [
          { title: 'Coverage', body: '97%', metric: '97%' },
          { title: 'Failures', body: '0', metric: '0' },
        ],
      }),
    ];

    for (const [index, spec] of specs.entries()) {
      const rendered = await renderDesign(spec, { generatorVersion: `template-test-${index}` });
      const outDir = await mkdtemp(join(tmpdir(), `graphic-designer-template-${index}-`));
      const written = await writeRenderArtifacts(rendered, outDir);
      const qa = await runQa({
        imagePath: written.imagePath,
        spec,
        metadata: written.metadata,
      });

      expect(qa.pass).toBe(true);
      expect(qa.issues).toHaveLength(0);
    }
  });
});
