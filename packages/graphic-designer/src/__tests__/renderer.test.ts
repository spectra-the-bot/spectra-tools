import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderDesign, writeRenderArtifacts } from '../renderer.js';
import { buildGtmPipelineSpec } from '../templates/gtm-pipeline.js';

describe('renderer', () => {
  it('is deterministic for same spec + generator version', async () => {
    const spec = buildGtmPipelineSpec({
      title: 'Determinism Test',
      subtitle: 'Same input should produce same hash',
      stages: [
        { name: 'Ingest', description: 'Collect target signals', metric: '120 leads' },
        { name: 'Score', description: 'Prioritize opportunities', metric: '42 SQOs' },
        { name: 'Ship', description: 'Deliver launch kits', metric: '9 campaigns' },
      ],
    });

    const first = await renderDesign(spec, {
      generatorVersion: 'test-1.0.0',
      renderedAt: '2026-03-09T00:00:00.000Z',
    });
    const second = await renderDesign(spec, {
      generatorVersion: 'test-1.0.0',
      renderedAt: '2026-03-09T00:00:01.000Z',
    });

    expect(first.metadata.specHash).toBe(second.metadata.specHash);
    expect(first.metadata.artifactHash).toBe(second.metadata.artifactHash);
    expect(first.png.equals(second.png)).toBe(true);
  });

  it('writes image and metadata sidecar with deterministic naming strategy', async () => {
    const spec = buildGtmPipelineSpec({
      title: 'Write Test',
      stages: [
        { name: 'A', description: 'a' },
        { name: 'B', description: 'b' },
        { name: 'C', description: 'c' },
      ],
    });

    const render = await renderDesign(spec, { generatorVersion: 'test-1.0.0' });
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-'));
    const written = await writeRenderArtifacts(render, dir);

    const metaRaw = await readFile(written.metadataPath, 'utf8');
    const parsed = JSON.parse(metaRaw) as { artifactHash: string; artifactBaseName: string };

    expect(written.imagePath).toContain(`${render.metadata.artifactBaseName}.png`);
    expect(parsed.artifactHash).toBe(render.metadata.artifactHash);
    expect(parsed.artifactBaseName).toBe(render.metadata.artifactBaseName);
  });
});
