import { readFileSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli, z } from 'incur';
import { compareImages } from './compare.js';
import { publishToGist } from './publish/gist.js';
import { publishToGitHub } from './publish/github.js';
import { readMetadata, runQa } from './qa.js';
import {
  type IterationMeta,
  inferSidecarPath,
  renderDesign,
  writeRenderArtifacts,
} from './renderer.js';
import { type DesignSpec, parseDesignSpec } from './spec.schema.js';
import {
  buildCardsSpec,
  buildCodeSpec,
  buildFlowchartSpec,
  buildTerminalSpec,
} from './templates/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  version: string;
};

const cli = Cli.create('design', {
  version: pkg.version,
  description: 'Deterministic graphic designer pipeline: render → QA → publish.',
});

const renderOutputSchema = z.object({
  imagePath: z.string(),
  metadataPath: z.string(),
  specPath: z.string(),
  artifactHash: z.string(),
  specHash: z.string(),
  layoutMode: z.string(),
  iteration: z
    .object({
      current: z.number().int().positive(),
      max: z.number().int().positive(),
      isLast: z.boolean(),
      notes: z.string().optional(),
    })
    .optional(),
  qa: z.object({
    pass: z.boolean(),
    issueCount: z.number(),
    issues: z.array(
      z.object({
        code: z.string(),
        severity: z.string(),
        message: z.string(),
        elementId: z.string().optional(),
      }),
    ),
  }),
});

type RenderOutput = z.infer<typeof renderOutputSchema>;

const compareOutputSchema = z.object({
  targetPath: z.string(),
  renderedPath: z.string(),
  targetDimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  renderedDimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  normalizedDimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  dimensionMismatch: z.boolean(),
  grid: z.number().int().positive(),
  threshold: z.number(),
  closeThreshold: z.number(),
  similarity: z.number(),
  verdict: z.enum(['match', 'close', 'mismatch']),
  regions: z.array(
    z.object({
      label: z.string(),
      row: z.number().int().nonnegative(),
      column: z.number().int().nonnegative(),
      similarity: z.number(),
    }),
  ),
});

async function readJson(path: string): Promise<unknown> {
  if (path === '-') {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }

  const raw = await readFile(resolve(path), 'utf8');
  return JSON.parse(raw) as unknown;
}

function specPathFor(metadataPath: string): string {
  return metadataPath.replace(/\.meta\.json$/iu, '.spec.json');
}

function splitCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseLineRange(range: string): { start: number; end: number } {
  const match = /^(\d+)\s*-\s*(\d+)$/u.exec(range.trim());
  if (!match) {
    throw new Error(`Invalid --lines value "${range}". Expected format "start-end".`);
  }

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);

  if (start <= 0 || end <= 0 || end < start) {
    throw new Error(`Invalid --lines range "${range}". Expected positive ascending range.`);
  }

  return { start, end };
}

function parseIntegerList(value: string): number[] {
  const values = splitCommaList(value).map((part) => {
    const parsed = Number.parseInt(part, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid integer value "${part}" in list "${value}".`);
    }
    return parsed;
  });

  return [...new Set(values)].sort((a, b) => a - b);
}

function readCodeRange(code: string, start: number, end: number): string {
  const lines = code.split(/\r?\n/u);
  return lines.slice(start - 1, end).join('\n');
}

function parseIterationMeta(options: {
  iteration?: number;
  maxIterations?: number;
  iterationNotes?: string;
  previousHash?: string;
}): IterationMeta | undefined {
  if (options.iteration == null) {
    if (options.maxIterations != null || options.iterationNotes || options.previousHash) {
      throw new Error(
        '--iteration is required when using --max-iterations, --iteration-notes, or --previous-hash.',
      );
    }
    return undefined;
  }

  if (options.maxIterations != null && options.maxIterations < options.iteration) {
    throw new Error('--max-iterations must be greater than or equal to --iteration.');
  }

  return {
    iteration: options.iteration,
    ...(options.maxIterations != null ? { maxIterations: options.maxIterations } : {}),
    ...(options.iterationNotes ? { notes: options.iterationNotes } : {}),
    ...(options.previousHash ? { previousHash: options.previousHash } : {}),
  };
}

async function runRenderPipeline(
  spec: DesignSpec,
  options: { out: string; specOut?: string; iteration?: IterationMeta },
): Promise<RenderOutput> {
  const renderResult = await renderDesign(spec, {
    generatorVersion: pkg.version,
    ...(options.iteration ? { iteration: options.iteration } : {}),
  });
  const written = await writeRenderArtifacts(renderResult, options.out);

  const specPath = options.specOut ? resolve(options.specOut) : specPathFor(written.metadataPath);
  await mkdir(dirname(specPath), { recursive: true });
  await writeFile(specPath, JSON.stringify(spec, null, 2));

  const qa = await runQa({
    imagePath: written.imagePath,
    spec,
    metadata: written.metadata,
  });

  return {
    imagePath: written.imagePath,
    metadataPath: written.metadataPath,
    specPath,
    artifactHash: written.metadata.artifactHash,
    specHash: written.metadata.specHash,
    layoutMode: spec.layout.mode,
    ...(written.metadata.iteration
      ? {
          iteration: {
            current: written.metadata.iteration.iteration,
            max: written.metadata.iteration.maxIterations ?? written.metadata.iteration.iteration,
            isLast:
              (written.metadata.iteration.maxIterations ?? written.metadata.iteration.iteration) ===
              written.metadata.iteration.iteration,
            ...(written.metadata.iteration.notes
              ? { notes: written.metadata.iteration.notes }
              : {}),
          },
        }
      : {}),
    qa: {
      pass: qa.pass,
      issueCount: qa.issues.length,
      issues: qa.issues,
    },
  };
}

cli.command('render', {
  description: 'Render a deterministic design artifact from a DesignSpec JSON file.',
  options: z.object({
    spec: z.string().describe('Path to DesignSpec JSON file (or "-" to read JSON from stdin)'),
    out: z.string().describe('Output file path (.png) or output directory'),
    specOut: z
      .string()
      .optional()
      .describe('Optional explicit output path for normalized spec JSON'),
    iteration: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional iteration number for iterative workflows (1-indexed)'),
    iterationNotes: z
      .string()
      .optional()
      .describe('Optional notes for the current iteration metadata'),
    maxIterations: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional maximum planned iteration count'),
    previousHash: z
      .string()
      .optional()
      .describe('Optional artifact hash from the previous iteration'),
    allowQaFail: z.boolean().default(false).describe('Allow render success even if QA fails'),
  }),
  output: renderOutputSchema,
  examples: [
    {
      options: {
        spec: './specs/pipeline.json',
        out: './output',
      },
      description: 'Render a design spec and write .png/.meta/.spec artifacts',
    },
  ],
  async run(c) {
    const spec = parseDesignSpec(await readJson(c.options.spec));

    let iteration: IterationMeta | undefined;
    try {
      iteration = parseIterationMeta({
        ...(c.options.iteration != null ? { iteration: c.options.iteration } : {}),
        ...(c.options.maxIterations != null ? { maxIterations: c.options.maxIterations } : {}),
        ...(c.options.iterationNotes ? { iterationNotes: c.options.iterationNotes } : {}),
        ...(c.options.previousHash ? { previousHash: c.options.previousHash } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.error({
        code: 'INVALID_ITERATION_OPTIONS',
        message,
        retryable: false,
      });
    }

    const runReport = await runRenderPipeline(spec, {
      out: c.options.out,
      ...(c.options.specOut ? { specOut: c.options.specOut } : {}),
      ...(iteration ? { iteration } : {}),
    });

    if (!runReport.qa.pass && !c.options.allowQaFail) {
      return c.error({
        code: 'QA_FAILED',
        message: `Render completed but QA failed (${runReport.qa.issueCount} issues). Review qa output.`,
        retryable: false,
      });
    }

    return c.ok(runReport);
  },
});

cli.command('compare', {
  description:
    'Compare a rendered design against a target image using structural similarity scoring.',
  options: z.object({
    target: z.string().describe('Path to target image (baseline)'),
    rendered: z.string().describe('Path to rendered image to evaluate'),
    grid: z.number().int().positive().default(3).describe('Grid size for per-region scoring'),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.8)
      .describe('Minimum similarity score required for a match verdict'),
  }),
  output: compareOutputSchema,
  examples: [
    {
      options: {
        target: './designs/target.png',
        rendered: './output/design-v2-g0.4.0-sabc123.png',
        grid: 3,
        threshold: 0.8,
      },
      description: 'Compare two images and report overall + per-region similarity scores',
    },
  ],
  async run(c) {
    try {
      return c.ok(
        await compareImages(c.options.target, c.options.rendered, {
          grid: c.options.grid,
          threshold: c.options.threshold,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.error({
        code: 'COMPARE_FAILED',
        message: `Unable to compare images: ${message}`,
        retryable: false,
      });
    }
  },
});

const template = Cli.create('template', {
  description: 'Generate common design templates and run the full render → QA pipeline.',
});

template.command('flowchart', {
  description: 'Build and render a flowchart from concise node/edge input.',
  options: z.object({
    nodes: z
      .string()
      .describe('Comma-separated node names, optionally with :shape (example: Decision:diamond)'),
    edges: z.string().describe('Comma-separated edges as From->To or From->To:label'),
    title: z.string().optional().describe('Optional header title'),
    direction: z.enum(['TB', 'BT', 'LR', 'RL']).default('TB').describe('Auto-layout direction'),
    algorithm: z
      .enum(['layered', 'stress', 'force', 'radial', 'box'])
      .default('layered')
      .describe('Auto-layout algorithm'),
    theme: z.string().default('dark').describe('Theme name'),
    nodeShape: z.string().optional().describe('Default shape for nodes without explicit :shape'),
    width: z.number().int().positive().optional().describe('Canvas width override'),
    height: z.number().int().positive().optional().describe('Canvas height override'),
    out: z.string().describe('Output file path (.png) or output directory'),
  }),
  output: renderOutputSchema,
  async run(c) {
    const nodes = splitCommaList(c.options.nodes);
    const edges = splitCommaList(c.options.edges);

    if (nodes.length === 0) {
      return c.error({
        code: 'INVALID_TEMPLATE_INPUT',
        message: 'Flowchart template requires at least one node.',
        retryable: false,
      });
    }

    if (edges.length === 0) {
      return c.error({
        code: 'INVALID_TEMPLATE_INPUT',
        message: 'Flowchart template requires at least one edge.',
        retryable: false,
      });
    }

    const spec = buildFlowchartSpec({
      nodes,
      edges,
      ...(c.options.title ? { title: c.options.title } : {}),
      direction: c.options.direction,
      algorithm: c.options.algorithm,
      theme: c.options.theme,
      ...(c.options.nodeShape ? { nodeShape: c.options.nodeShape } : {}),
      ...(c.options.width ? { width: c.options.width } : {}),
      ...(c.options.height ? { height: c.options.height } : {}),
    });

    const runReport = await runRenderPipeline(spec, { out: c.options.out });

    if (!runReport.qa.pass) {
      return c.error({
        code: 'QA_FAILED',
        message: `Render completed but QA failed (${runReport.qa.issueCount} issues). Review qa output.`,
        retryable: false,
      });
    }

    return c.ok(runReport);
  },
});

template.command('code', {
  description: 'Build and render a code screenshot from inline code or a source file.',
  options: z.object({
    code: z.string().optional().describe('Inline code string (mutually exclusive with --file)'),
    file: z.string().optional().describe('Path to a source file to render'),
    language: z.string().describe('Language for syntax highlighting'),
    lines: z.string().optional().describe('Optional line range to extract (example: 10-25)'),
    title: z.string().optional().describe('Optional code block title'),
    theme: z.string().default('dark').describe('Theme name'),
    showLineNumbers: z.boolean().default(false).describe('Show line numbers'),
    highlightLines: z
      .string()
      .optional()
      .describe('Comma-separated line numbers to highlight (example: 3,4,5)'),
    surroundColor: z
      .string()
      .optional()
      .describe('Outer surround color (default: rgba(171, 184, 195, 1))'),
    windowControls: z
      .enum(['macos', 'bw', 'none'])
      .default('macos')
      .describe('Window chrome controls style'),
    scale: z
      .number()
      .int()
      .refine((value) => value === 1 || value === 2 || value === 4, {
        message: 'Scale must be one of: 1, 2, 4',
      })
      .default(2)
      .describe('Export scale factor'),
    width: z.number().int().positive().optional().describe('Canvas width override'),
    height: z.number().int().positive().optional().describe('Canvas height override'),
    out: z.string().describe('Output file path (.png) or output directory'),
  }),
  output: renderOutputSchema,
  async run(c) {
    if (Boolean(c.options.code) === Boolean(c.options.file)) {
      return c.error({
        code: 'INVALID_TEMPLATE_INPUT',
        message: 'Code template requires exactly one of --code or --file.',
        retryable: false,
      });
    }

    let source = c.options.code ?? '';
    if (c.options.file) {
      try {
        source = await readFile(resolve(c.options.file), 'utf8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.error({
          code: 'FILE_READ_FAILED',
          message: `Failed to read --file ${c.options.file}: ${message}`,
          retryable: false,
        });
      }
    }

    let startLine = 1;
    if (c.options.lines) {
      const range = parseLineRange(c.options.lines);
      source = readCodeRange(source, range.start, range.end);
      startLine = range.start;
    }

    const highlightLines = c.options.highlightLines
      ? parseIntegerList(c.options.highlightLines)
      : undefined;
    const title = c.options.title ?? (c.options.file ? basename(c.options.file) : undefined);

    const spec = buildCodeSpec({
      code: source,
      language: c.options.language,
      ...(title ? { title } : {}),
      theme: c.options.theme,
      showLineNumbers: c.options.showLineNumbers,
      ...(highlightLines && highlightLines.length > 0 ? { highlightLines } : {}),
      ...(startLine > 1 ? { startLine } : {}),
      ...(c.options.surroundColor ? { surroundColor: c.options.surroundColor } : {}),
      windowControls: c.options.windowControls,
      scale: c.options.scale,
      ...(c.options.width ? { width: c.options.width } : {}),
      ...(c.options.height ? { height: c.options.height } : {}),
    });

    const runReport = await runRenderPipeline(spec, { out: c.options.out });

    if (!runReport.qa.pass) {
      return c.error({
        code: 'QA_FAILED',
        message: `Render completed but QA failed (${runReport.qa.issueCount} issues). Review qa output.`,
        retryable: false,
      });
    }

    return c.ok(runReport);
  },
});

template.command('terminal', {
  description: 'Build and render a terminal screenshot from command/output or raw content.',
  options: z.object({
    command: z.string().optional().describe('Command to show'),
    output: z.string().optional().describe('Command output text'),
    content: z.string().optional().describe('Raw terminal content (alternative to command/output)'),
    title: z.string().optional().describe('Window title'),
    prompt: z.string().default('$ ').describe('Prompt prefix used for formatted command mode'),
    windowControls: z
      .enum(['macos', 'bw', 'none'])
      .default('macos')
      .describe('Window chrome controls style'),
    surroundColor: z
      .string()
      .optional()
      .describe('Outer surround color (default: rgba(171, 184, 195, 1))'),
    scale: z
      .number()
      .int()
      .refine((value) => value === 1 || value === 2 || value === 4, {
        message: 'Scale must be one of: 1, 2, 4',
      })
      .default(2)
      .describe('Export scale factor'),
    theme: z.string().default('dark').describe('Theme name'),
    width: z.number().int().positive().optional().describe('Canvas width override'),
    height: z.number().int().positive().optional().describe('Canvas height override'),
    out: z.string().describe('Output file path (.png) or output directory'),
  }),
  output: renderOutputSchema,
  async run(c) {
    if (c.options.content && (c.options.command || c.options.output)) {
      return c.error({
        code: 'INVALID_TEMPLATE_INPUT',
        message: 'Use either --content or --command/--output, not both.',
        retryable: false,
      });
    }

    const spec = buildTerminalSpec({
      ...(c.options.command ? { command: c.options.command } : {}),
      ...(c.options.output ? { output: c.options.output } : {}),
      ...(c.options.content ? { content: c.options.content } : {}),
      ...(c.options.title ? { title: c.options.title } : {}),
      prompt: c.options.prompt,
      windowControls: c.options.windowControls,
      ...(c.options.surroundColor ? { surroundColor: c.options.surroundColor } : {}),
      scale: c.options.scale,
      theme: c.options.theme,
      ...(c.options.width ? { width: c.options.width } : {}),
      ...(c.options.height ? { height: c.options.height } : {}),
    });

    const runReport = await runRenderPipeline(spec, { out: c.options.out });

    if (!runReport.qa.pass) {
      return c.error({
        code: 'QA_FAILED',
        message: `Render completed but QA failed (${runReport.qa.issueCount} issues). Review qa output.`,
        retryable: false,
      });
    }

    return c.ok(runReport);
  },
});

template.command('cards', {
  description: 'Build and render a card grid from JSON card input.',
  options: z.object({
    cards: z
      .string()
      .describe('JSON array of cards: [{"title":"...","body":"...","metric":"..."}]'),
    title: z.string().optional().describe('Header title'),
    subtitle: z.string().optional().describe('Header subtitle'),
    columns: z.number().int().positive().optional().describe('Grid columns (default: auto)'),
    theme: z.string().default('dark').describe('Theme name'),
    width: z.number().int().positive().optional().describe('Canvas width override'),
    height: z.number().int().positive().optional().describe('Canvas height override'),
    out: z.string().describe('Output file path (.png) or output directory'),
  }),
  output: renderOutputSchema,
  async run(c) {
    let cardsInput: unknown;
    try {
      cardsInput = JSON.parse(c.options.cards) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.error({
        code: 'INVALID_TEMPLATE_INPUT',
        message: `Failed to parse --cards JSON: ${message}`,
        retryable: false,
      });
    }

    if (!Array.isArray(cardsInput)) {
      return c.error({
        code: 'INVALID_TEMPLATE_INPUT',
        message: '--cards must be a JSON array.',
        retryable: false,
      });
    }

    const spec = buildCardsSpec({
      cards: cardsInput as Array<{
        title: string;
        body: string;
        badge?: string;
        metric?: string;
        tone?: string;
      }>,
      ...(c.options.title ? { title: c.options.title } : {}),
      ...(c.options.subtitle ? { subtitle: c.options.subtitle } : {}),
      ...(c.options.columns ? { columns: c.options.columns } : {}),
      theme: c.options.theme,
      ...(c.options.width ? { width: c.options.width } : {}),
      ...(c.options.height ? { height: c.options.height } : {}),
    });

    const runReport = await runRenderPipeline(spec, { out: c.options.out });

    if (!runReport.qa.pass) {
      return c.error({
        code: 'QA_FAILED',
        message: `Render completed but QA failed (${runReport.qa.issueCount} issues). Review qa output.`,
        retryable: false,
      });
    }

    return c.ok(runReport);
  },
});

cli.command(template);

cli.command('qa', {
  description:
    'Run hard QA checks against a rendered image + spec (and optional sidecar metadata).',
  options: z.object({
    in: z.string().describe('Path to rendered PNG'),
    spec: z.string().describe('Path to normalized DesignSpec JSON'),
    meta: z.string().optional().describe('Optional sidecar metadata path (.meta.json)'),
    reference: z
      .string()
      .optional()
      .describe('Optional reference image path for visual comparison'),
  }),
  output: z.object({
    pass: z.boolean(),
    checkedAt: z.string(),
    imagePath: z.string(),
    issueCount: z.number(),
    issues: z.array(
      z.object({
        code: z.string(),
        severity: z.string(),
        message: z.string(),
        elementId: z.string().optional(),
      }),
    ),
    reference: z
      .object({
        similarity: z.number(),
        verdict: z.enum(['match', 'close', 'mismatch']),
        regions: z.array(
          z.object({
            label: z.string(),
            similarity: z.number(),
            description: z.string().optional(),
          }),
        ),
      })
      .optional(),
  }),
  examples: [
    {
      options: {
        in: './output/design-v2-g0.2.0-sabc123.png',
        spec: './output/design-v2-g0.2.0-sabc123.spec.json',
      },
      description: 'Validate dimensions, clipping, overlap, contrast, and footer spacing',
    },
  ],
  async run(c) {
    const spec = parseDesignSpec(await readJson(c.options.spec));
    const metadataPath = c.options.meta ? resolve(c.options.meta) : inferSidecarPath(c.options.in);

    let metadata: Awaited<ReturnType<typeof readMetadata>> | undefined;
    try {
      metadata = await readMetadata(metadataPath);
    } catch {
      metadata = undefined;
    }

    const report = await runQa({
      imagePath: c.options.in,
      spec,
      ...(metadata ? { metadata } : {}),
      ...(c.options.reference ? { referencePath: c.options.reference } : {}),
    });

    const response = {
      pass: report.pass,
      checkedAt: report.checkedAt,
      imagePath: report.imagePath,
      issueCount: report.issues.length,
      issues: report.issues,
      ...(report.reference ? { reference: report.reference } : {}),
    };

    if (!report.pass) {
      return c.error({
        code: 'QA_FAILED',
        message: `QA checks failed (${report.issues.length} issues).`,
        retryable: false,
      });
    }

    return c.ok(response);
  },
});

cli.command('publish', {
  description: 'Publish deterministic artifacts to gist or github (QA gate required by default).',
  options: z.object({
    in: z.string().describe('Path to rendered PNG'),
    target: z.enum(['gist', 'github']).describe('Publish target'),
    spec: z
      .string()
      .optional()
      .describe('Path to DesignSpec JSON (default: infer from sidecar name)'),
    meta: z
      .string()
      .optional()
      .describe('Path to metadata sidecar JSON (default: infer from image name)'),
    allowQaFail: z.boolean().default(false).describe('Bypass QA gate (not recommended)'),
    repo: z
      .string()
      .optional()
      .describe('GitHub target repo in owner/name format (github target only)'),
    branch: z.string().optional().describe('GitHub branch (default: main)'),
    pathPrefix: z
      .string()
      .optional()
      .describe('GitHub path prefix for uploads (default: artifacts)'),
    gistId: z.string().optional().describe('Existing gist id to update (gist target only)'),
    description: z.string().optional().describe('Publish description/commit message'),
    public: z.boolean().default(false).describe('Publish gist publicly (gist target only)'),
  }),
  output: z.object({
    target: z.enum(['gist', 'github']),
    qa: z.object({
      pass: z.boolean(),
      issueCount: z.number(),
    }),
    publish: z.object({
      summary: z.string(),
      url: z.string().optional(),
    }),
  }),
  examples: [
    {
      options: {
        in: './output/design-v2-g0.2.0-sabc123.png',
        target: 'gist',
      },
      description: 'Publish a rendered design to a gist with retry/backoff',
    },
    {
      options: {
        in: './output/design-v2-g0.2.0-sabc123.png',
        target: 'github',
        repo: 'spectra-the-bot/spectra-tools',
        branch: 'main',
      },
      description: 'Publish artifact + sidecar metadata into a GitHub repository path',
    },
  ],
  async run(c) {
    const imagePath = resolve(c.options.in);
    const metadataPath = c.options.meta ? resolve(c.options.meta) : inferSidecarPath(imagePath);
    const specPath = c.options.spec
      ? resolve(c.options.spec)
      : metadataPath.replace(/\.meta\.json$/iu, '.spec.json');

    const metadata = await readMetadata(metadataPath);
    const spec = parseDesignSpec(await readJson(specPath));

    const qa = await runQa({ imagePath, spec, metadata });
    if (!qa.pass && !c.options.allowQaFail) {
      return c.error({
        code: 'QA_FAILED',
        message: `Publish blocked by QA gate (${qa.issues.length} issues).`,
        retryable: false,
      });
    }

    if (c.options.target === 'gist') {
      const gist = await publishToGist({
        imagePath,
        metadataPath,
        public: c.options.public,
        filenamePrefix: metadata.artifactBaseName,
        ...(c.options.gistId ? { gistId: c.options.gistId } : {}),
        ...(c.options.description ? { description: c.options.description } : {}),
      });

      return c.ok({
        target: 'gist' as const,
        qa: {
          pass: qa.pass,
          issueCount: qa.issues.length,
        },
        publish: {
          summary: `Published ${gist.files.length} files to gist ${gist.gistId}.`,
          url: gist.htmlUrl,
        },
      });
    }

    if (!c.options.repo) {
      return c.error({
        code: 'MISSING_REPO',
        message: '--repo owner/name is required when target=github.',
        retryable: false,
      });
    }

    const github = await publishToGitHub({
      imagePath,
      metadataPath,
      repo: c.options.repo,
      ...(c.options.branch ? { branch: c.options.branch } : {}),
      ...(c.options.pathPrefix ? { pathPrefix: c.options.pathPrefix } : {}),
      ...(c.options.description ? { commitMessage: c.options.description } : {}),
    });

    const url = github.files.find((file) => file.htmlUrl)?.htmlUrl;
    return c.ok({
      target: 'github' as const,
      qa: {
        pass: qa.pass,
        issueCount: qa.issues.length,
      },
      publish: {
        summary: `Published ${github.files.length} files to ${github.repo}@${github.branch}.`,
        url,
      },
    });
  },
});

export { cli };

const isMain = (() => {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  cli.serve();
}
