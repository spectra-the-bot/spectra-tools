import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runQa } from '../qa.js';
import { renderDesign, writeRenderArtifacts } from '../renderer.js';
import { buildGtmStatsSpec } from '../templates/gtm-stats.js';

describe('qa gate', () => {
  it('passes for a valid rendered artifact', async () => {
    const spec = buildGtmStatsSpec({
      title: 'QA Pass',
      stats: [
        { label: 'Coverage', value: '90%', insight: 'steady growth' },
        { label: 'CTR', value: '4.4%', insight: 'strong channel mix' },
        { label: 'CPA', value: '$10', insight: 'cost improving' },
      ],
    });

    const render = await renderDesign(spec, { generatorVersion: 'test-qa' });
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-qa-pass-'));
    const written = await writeRenderArtifacts(render, dir);

    const report = await runQa({
      imagePath: written.imagePath,
      spec,
      metadata: written.metadata,
    });

    expect(report.pass).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('fails when contrast rules are violated', async () => {
    const base = buildGtmStatsSpec({
      title: 'QA Fail',
      stats: [
        { label: 'One', value: '1', insight: 'a' },
        { label: 'Two', value: '2', insight: 'b' },
        { label: 'Three', value: '3', insight: 'c' },
      ],
    });

    const spec = {
      ...base,
      theme: {
        ...base.theme,
        text: base.theme.surface,
        textMuted: base.theme.surface,
      },
    };

    const render = await renderDesign(spec, { generatorVersion: 'test-qa' });
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-qa-fail-'));
    const imagePath = join(dir, 'out.png');
    const metaPath = join(dir, 'out.meta.json');

    await writeFile(imagePath, render.png);
    await writeFile(metaPath, JSON.stringify(render.metadata, null, 2));

    const report = await runQa({
      imagePath,
      spec,
      metadata: render.metadata,
    });

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'LOW_CONTRAST')).toBe(true);
  });
});
