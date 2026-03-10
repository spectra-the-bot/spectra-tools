import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cli } from '../cli.js';
import { type CompareImagesReport, compareImages } from '../compare.js';

async function writeImage(
  path: string,
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Promise<void> {
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [r, g, b, a] = pixel(x, y);
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }

  await sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(path);
}

function toReport(payload: unknown): CompareImagesReport {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const envelope = payload as { data?: unknown };
    return envelope.data as CompareImagesReport;
  }

  return payload as CompareImagesReport;
}

describe('compareImages', () => {
  it('returns perfect similarity for identical images', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-compare-identical-'));
    const target = join(dir, 'target.png');
    const rendered = join(dir, 'rendered.png');

    await writeImage(target, 24, 24, (x, y) => {
      const isAccent = (x + y) % 2 === 0;
      return isAccent ? [90, 150, 240, 255] : [20, 25, 35, 255];
    });

    await writeImage(rendered, 24, 24, (x, y) => {
      const isAccent = (x + y) % 2 === 0;
      return isAccent ? [90, 150, 240, 255] : [20, 25, 35, 255];
    });

    const report = await compareImages(target, rendered, { grid: 3, threshold: 0.8 });

    expect(report.similarity).toBe(1);
    expect(report.verdict).toBe('match');
    expect(report.regions.every((region) => region.similarity === 1)).toBe(true);
  });

  it('flags strongly different images as mismatch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-compare-different-'));
    const target = join(dir, 'target.png');
    const rendered = join(dir, 'rendered.png');

    await writeImage(target, 32, 32, () => [0, 0, 0, 255]);
    await writeImage(rendered, 32, 32, () => [255, 255, 255, 255]);

    const report = await compareImages(target, rendered, { grid: 3, threshold: 0.8 });

    expect(report.verdict).toBe('mismatch');
    expect(report.similarity).toBeLessThan(0.5);
  });

  it('normalizes dimensions when target and rendered image sizes differ', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-compare-dimension-mismatch-'));
    const target = join(dir, 'target.png');
    const rendered = join(dir, 'rendered.png');

    await writeImage(target, 40, 20, (x) => (x < 20 ? [30, 170, 120, 255] : [240, 240, 240, 255]));
    await writeImage(rendered, 20, 40, (_, y) =>
      y < 20 ? [30, 170, 120, 255] : [240, 240, 240, 255],
    );

    const report = await compareImages(target, rendered, { grid: 3, threshold: 0.8 });

    expect(report.dimensionMismatch).toBe(true);
    expect(report.targetDimensions).toEqual({ width: 40, height: 20 });
    expect(report.renderedDimensions).toEqual({ width: 20, height: 40 });
    expect(report.normalizedDimensions).toEqual({ width: 40, height: 40 });
  });

  it('labels grid regions in row-major order (A1..C3)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-compare-grid-labels-'));
    const target = join(dir, 'target.png');
    const rendered = join(dir, 'rendered.png');

    await writeImage(target, 18, 18, (x, y) => {
      const tone = (x + y) % 3 === 0 ? 220 : 60;
      return [tone, tone, tone, 255];
    });
    await writeImage(rendered, 18, 18, (x, y) => {
      const tone = (x + y) % 3 === 0 ? 220 : 60;
      return [tone, tone, tone, 255];
    });

    const report = await compareImages(target, rendered, { grid: 3, threshold: 0.8 });

    expect(report.regions.map((region) => region.label)).toEqual([
      'A1',
      'A2',
      'A3',
      'B1',
      'B2',
      'B3',
      'C1',
      'C2',
      'C3',
    ]);
    expect(report.regions[0]).toMatchObject({ row: 0, column: 0, label: 'A1' });
    expect(report.regions[8]).toMatchObject({ row: 2, column: 2, label: 'C3' });
  });

  it('emits machine-readable output with --format json via design compare', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graphic-designer-compare-cli-json-'));
    const target = join(dir, 'target.png');
    const rendered = join(dir, 'rendered.png');

    await writeImage(target, 16, 16, () => [40, 90, 150, 255]);
    await writeImage(rendered, 16, 16, () => [40, 90, 150, 255]);

    let output = '';
    let exitCode = 0;

    await cli.serve(
      [
        'compare',
        '--target',
        target,
        '--rendered',
        rendered,
        '--grid',
        '3',
        '--threshold',
        '0.8',
        '--format',
        'json',
      ],
      {
        stdout: (chunk) => {
          output += chunk;
        },
        exit: (code) => {
          exitCode = code;
        },
      },
    );

    expect(exitCode).toBe(0);

    const report = toReport(JSON.parse(output));
    expect(report.verdict).toBe('match');
    expect(report.similarity).toBe(1);
    expect(Array.isArray(report.regions)).toBe(true);
    expect(report.regions).toHaveLength(9);
  });
});
