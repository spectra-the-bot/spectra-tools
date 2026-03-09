import { readFileSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli, z } from 'incur';
import { publishToGist } from './publish/gist.js';
import { publishToGitHub } from './publish/github.js';
import { readMetadata, runQa } from './qa.js';
import { inferSidecarPath, renderDesign, writeRenderArtifacts } from './renderer.js';
import type { DesignSpec } from './spec.schema.js';
import { parseDesignSpec } from './spec.schema.js';
import { buildGtmPipelineSpec } from './templates/gtm-pipeline.js';
import { buildGtmStatsSpec } from './templates/gtm-stats.js';
import { buildScoutDispatchSpec } from './templates/scout-dispatch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  version: string;
};

const templateSchema = z.enum(['gtm-pipeline', 'gtm-stats', 'scout-dispatch']);

const cli = Cli.create('design', {
  version: pkg.version,
  description: 'Deterministic graphic designer agent pipeline: render → QA → publish.',
});

async function readJson(path: string): Promise<unknown> {
  const raw = await readFile(resolve(path), 'utf8');
  return JSON.parse(raw) as unknown;
}

function buildSpecFromTemplate(
  template: z.infer<typeof templateSchema>,
  data: unknown,
): DesignSpec {
  switch (template) {
    case 'gtm-pipeline':
      return buildGtmPipelineSpec(data);
    case 'gtm-stats':
      return buildGtmStatsSpec(data);
    case 'scout-dispatch':
      return buildScoutDispatchSpec(data);
    default:
      throw new Error(`Unsupported template: ${template satisfies never}`);
  }
}

function specPathFor(metadataPath: string): string {
  return metadataPath.replace(/\.meta\.json$/iu, '.spec.json');
}

cli.command('render', {
  description: 'Render a deterministic design artifact from template data.',
  options: z.object({
    template: templateSchema.describe('Template key: gtm-pipeline | gtm-stats | scout-dispatch'),
    data: z.string().describe('Path to template data JSON file'),
    out: z.string().describe('Output file path (.png) or output directory'),
    specOut: z
      .string()
      .optional()
      .describe('Optional explicit output path for normalized spec JSON'),
    allowQaFail: z.boolean().default(false).describe('Allow render success even if QA fails'),
  }),
  output: z.object({
    template: templateSchema,
    imagePath: z.string(),
    metadataPath: z.string(),
    specPath: z.string(),
    artifactHash: z.string(),
    specHash: z.string(),
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
  }),
  examples: [
    {
      options: {
        template: 'gtm-pipeline',
        data: './data/pipeline.json',
        out: './output',
      },
      description: 'Render a pipeline graphic and write .png/.meta/.spec artifacts',
    },
  ],
  async run(c) {
    const data = await readJson(c.options.data);
    const spec = buildSpecFromTemplate(c.options.template, data);
    const renderResult = await renderDesign(spec, { generatorVersion: pkg.version });
    const written = await writeRenderArtifacts(renderResult, c.options.out);

    const specPath = c.options.specOut
      ? resolve(c.options.specOut)
      : specPathFor(written.metadataPath);
    await mkdir(dirname(specPath), { recursive: true });
    await writeFile(specPath, JSON.stringify(spec, null, 2));

    const qa = await runQa({
      imagePath: written.imagePath,
      spec,
      metadata: written.metadata,
    });

    const runReport = {
      template: c.options.template,
      imagePath: written.imagePath,
      metadataPath: written.metadataPath,
      specPath,
      artifactHash: written.metadata.artifactHash,
      specHash: written.metadata.specHash,
      qa: {
        pass: qa.pass,
        issueCount: qa.issues.length,
        issues: qa.issues,
      },
    };

    if (!qa.pass && !c.options.allowQaFail) {
      return c.error({
        code: 'QA_FAILED',
        message: `Render completed but QA failed (${qa.issues.length} issues). Review qa output.`,
        retryable: false,
      });
    }

    return c.ok(runReport);
  },
});

cli.command('qa', {
  description:
    'Run hard QA checks against a rendered image + spec (and optional sidecar metadata).',
  options: z.object({
    in: z.string().describe('Path to rendered PNG'),
    spec: z.string().describe('Path to normalized DesignSpec JSON'),
    meta: z.string().optional().describe('Optional sidecar metadata path (.meta.json)'),
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
  }),
  examples: [
    {
      options: {
        in: './output/gtm-pipeline-g0.1.0-sabc123.png',
        spec: './output/gtm-pipeline-g0.1.0-sabc123.spec.json',
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
    });

    const response = {
      pass: report.pass,
      checkedAt: report.checkedAt,
      imagePath: report.imagePath,
      issueCount: report.issues.length,
      issues: report.issues,
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
      attempts: z.number(),
      summary: z.string(),
      url: z.string().optional(),
    }),
  }),
  examples: [
    {
      options: {
        in: './output/gtm-stats-g0.1.0-sabc123.png',
        target: 'gist',
      },
      description: 'Publish a rendered design to a gist with retry/backoff',
    },
    {
      options: {
        in: './output/scout-dispatch-g0.1.0-sabc123.png',
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
          attempts: gist.attempts,
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
        attempts: github.attempts,
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
