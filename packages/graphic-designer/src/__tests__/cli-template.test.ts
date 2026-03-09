import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli } from '../cli.js';

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

describe('design template cli', () => {
  it('reads code from --file with --lines and runs full render pipeline', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'graphic-designer-cli-template-code-'));
    const sourcePath = join(tmp, 'sample.ts');
    const outDir = join(tmp, 'out');

    await writeFile(
      sourcePath,
      [
        'const one = 1;',
        'const two = 2;',
        'const three = 3;',
        'console.log(one, two, three);',
      ].join('\n'),
      'utf8',
    );

    const result = await runCli([
      'template',
      'code',
      '--file',
      sourcePath,
      '--language',
      'typescript',
      '--lines',
      '2-3',
      '--show-line-numbers',
      '--highlight-lines',
      '2,3',
      '--out',
      outDir,
      '--json',
    ]);

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.output) as {
      specPath: string;
      qa: { pass: boolean };
      imagePath: string;
      metadataPath: string;
    };

    expect(payload.qa.pass).toBe(true);

    const specRaw = await readFile(payload.specPath, 'utf8');
    const spec = JSON.parse(specRaw) as {
      elements: Array<
        | {
            type: 'code-block';
            code: string;
            startLine?: number;
            title?: string;
            highlightLines?: number[];
          }
        | { type: string }
      >;
    };

    const block = spec.elements.find((element) => element.type === 'code-block') as
      | {
          code: string;
          startLine?: number;
          title?: string;
          highlightLines?: number[];
        }
      | undefined;

    expect(block).toBeDefined();
    expect(block?.code).toBe('const two = 2;\nconst three = 3;');
    expect(block?.startLine).toBe(2);
    expect(block?.title).toBe('sample.ts');
    expect(block?.highlightLines).toEqual([2, 3]);
  });

  it('supports carbon style flags for code template', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'graphic-designer-cli-template-carbon-flags-'));
    const outDir = join(tmp, 'out');

    const result = await runCli([
      'template',
      'code',
      '--code',
      'console.log("hello")',
      '--language',
      'typescript',
      '--window-controls',
      'bw',
      '--surround-color',
      'rgba(10, 20, 30, 1)',
      '--scale',
      '4',
      '--out',
      outDir,
      '--json',
    ]);

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.output) as { specPath: string };
    const specRaw = await readFile(payload.specPath, 'utf8');
    const spec = JSON.parse(specRaw) as {
      elements: Array<
        | {
            type: 'code-block';
            style?: {
              windowControls?: string;
              surroundColor?: string;
              scale?: number;
            };
          }
        | { type: string }
      >;
    };

    const block = spec.elements.find((element) => element.type === 'code-block') as
      | {
          style?: {
            windowControls?: string;
            surroundColor?: string;
            scale?: number;
          };
        }
      | undefined;

    expect(block?.style?.windowControls).toBe('bw');
    expect(block?.style?.surroundColor).toBe('rgba(10, 20, 30, 1)');
    expect(block?.style?.scale).toBe(4);
  });

  it('renders flowchart template and returns render-command structured output', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'graphic-designer-cli-template-flowchart-'));
    const outDir = join(tmp, 'out');

    const result = await runCli([
      'template',
      'flowchart',
      '--nodes',
      'Start,Process,Decision:diamond,End',
      '--edges',
      'Start->Process,Process->Decision,Decision->End:yes,Decision->Process:retry',
      '--title',
      'CI/CD Pipeline',
      '--direction',
      'LR',
      '--algorithm',
      'stress',
      '--theme',
      'dracula',
      '--out',
      outDir,
      '--json',
    ]);

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.output) as {
      imagePath: string;
      metadataPath: string;
      specPath: string;
      artifactHash: string;
      specHash: string;
      layoutMode: string;
      qa: { pass: boolean; issueCount: number; issues: unknown[] };
    };

    expect(payload.layoutMode).toBe('auto');
    expect(payload.qa.pass).toBe(true);
    expect(payload.qa.issueCount).toBe(0);
    expect(payload.imagePath.endsWith('.png')).toBe(true);
    expect(payload.metadataPath.endsWith('.meta.json')).toBe(true);
    expect(payload.specPath.endsWith('.spec.json')).toBe(true);
    expect(payload.artifactHash.length).toBeGreaterThan(20);
    expect(payload.specHash.length).toBeGreaterThan(20);

    const specRaw = await readFile(payload.specPath, 'utf8');
    const spec = JSON.parse(specRaw) as { layout: { mode: string; algorithm?: string } };
    expect(spec.layout.mode).toBe('auto');
    expect(spec.layout.algorithm).toBe('stress');
  });
});
