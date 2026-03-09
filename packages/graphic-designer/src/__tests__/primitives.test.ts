import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { drawWindowChrome } from '../primitives/window-chrome.js';
import { drawGradientRect, drawRainbowRule, drawVignette } from '../primitives/gradients.js';
import { drawArrow, drawBezier, drawLine, drawOrthogonalPath } from '../primitives/lines.js';
import {
  drawCircle,
  drawCylinder,
  drawDiamond,
  drawEllipse,
  drawParallelogram,
  drawPill,
  drawRoundedRect,
} from '../primitives/shapes.js';
import { drawMonoText, drawTextBlock, drawTextLabel } from '../primitives/text.js';

describe('primitive drawing smoke tests', () => {
  it('draws shape primitives without throwing', async () => {
    const canvas = createCanvas(420, 260);
    const ctx = canvas.getContext('2d');

    drawRoundedRect(ctx, { x: 8, y: 8, width: 80, height: 50 }, 12, '#334B83', '#7AA2FF');
    drawCircle(ctx, { x: 140, y: 36 }, 24, '#1E7A58', '#65E4A3');
    drawDiamond(ctx, { x: 190, y: 8, width: 80, height: 50 }, '#7A5418', '#F4B860');
    drawPill(ctx, { x: 290, y: 8, width: 110, height: 50 }, '#8A2C2C', '#F97070');
    drawEllipse(ctx, { x: 8, y: 78, width: 120, height: 56 }, '#24345F', '#32426E');
    drawCylinder(ctx, { x: 150, y: 78, width: 120, height: 80 }, '#202D55', '#65E4A3');
    drawParallelogram(ctx, { x: 300, y: 78, width: 100, height: 60 }, '#111936', '#AAB9E8');

    const png = Buffer.from(await canvas.encode('png'));
    expect(png.byteLength).toBeGreaterThan(1024);
  });

  it('draws line primitives without throwing', async () => {
    const canvas = createCanvas(300, 220);
    const ctx = canvas.getContext('2d');

    drawLine(ctx, { x: 20, y: 20 }, { x: 280, y: 20 }, { color: '#7AA2FF', width: 2 });
    drawArrow(ctx, { x: 20, y: 50 }, { x: 280, y: 50 }, 'both', {
      color: '#65E4A3',
      width: 2,
      headSize: 10,
      dash: [6, 4],
    });
    drawBezier(
      ctx,
      [
        { x: 20, y: 90 },
        { x: 90, y: 140 },
        { x: 210, y: 40 },
        { x: 280, y: 100 },
      ],
      { color: '#F4B860', width: 2 },
    );
    drawOrthogonalPath(ctx, { x: 20, y: 170 }, { x: 280, y: 190 }, { color: '#F97070', width: 2 });

    const png = Buffer.from(await canvas.encode('png'));
    expect(png.byteLength).toBeGreaterThan(512);
  });

  it('draws chrome and text primitives without throwing', async () => {
    const canvas = createCanvas(420, 220);
    const ctx = canvas.getContext('2d');

    const chrome = drawWindowChrome(ctx, { x: 10, y: 10, width: 400, height: 180 }, {
      style: 'macos',
      title: 'Demo',
      backgroundColor: '#1A2547',
      fontFamily: 'Inter',
    });

    const textBlock = drawTextBlock(ctx, {
      x: 20,
      y: chrome.contentTop + 22,
      maxWidth: 380,
      lineHeight: 20,
      color: '#E8EEFF',
      text: 'This is a wrapped text block for primitive smoke testing in renderer phase 2.',
      maxLines: 3,
      fontSize: 14,
      fontWeight: 500,
      family: 'Inter',
    });

    const labelRect = drawTextLabel(ctx, 'edge label', { x: 200, y: 180 }, {
      fontSize: 12,
      fontFamily: 'Inter',
      color: '#E8EEFF',
      backgroundColor: '#0B1020',
      padding: 6,
      borderRadius: 8,
    });

    const mono = drawMonoText(ctx, ['const x = 1;', 'console.log(x);'], {
      x: 24,
      y: chrome.contentTop + 96,
      lineHeight: 18,
      fontSize: 13,
      fontFamily: 'JetBrains Mono',
      color: '#AAB9E8',
      showLineNumbers: true,
      highlightLines: [2],
      startLine: 10,
    });

    expect(textBlock.height).toBeGreaterThan(0);
    expect(labelRect.width).toBeGreaterThan(0);
    expect(mono.height).toBeGreaterThan(0);
  });

  it('supports bw and none chrome styles', () => {
    const canvas = createCanvas(320, 160);
    const ctx = canvas.getContext('2d');

    const bwChrome = drawWindowChrome(ctx, { x: 10, y: 10, width: 300, height: 140 }, {
      style: 'bw',
      title: 'BW',
      backgroundColor: '#E5E7EB',
      fontFamily: 'Inter',
    });

    const noneChrome = drawWindowChrome(ctx, { x: 10, y: 10, width: 300, height: 140 }, {
      style: 'none',
      title: 'Hidden',
      backgroundColor: '#111827',
      fontFamily: 'Inter',
    });

    expect(bwChrome.hasChrome).toBe(true);
    expect(bwChrome.contentTop).toBe(44);
    expect(noneChrome.hasChrome).toBe(false);
    expect(noneChrome.contentTop).toBe(10);
  });

  it('draws linear/radial gradients and a rainbow rule without throwing', async () => {
    const canvas = createCanvas(420, 240);
    const ctx = canvas.getContext('2d');

    drawGradientRect(
      ctx,
      { x: 0, y: 0, width: 210, height: 120 },
      {
        type: 'linear',
        angle: 180,
        stops: [
          { offset: 0, color: '#0B1020' },
          { offset: 1, color: '#1A2547' },
        ],
      },
    );
    drawGradientRect(
      ctx,
      { x: 210, y: 0, width: 210, height: 120 },
      {
        type: 'radial',
        stops: [
          { offset: 0, color: '#334B83' },
          { offset: 1, color: '#0B1020' },
        ],
      },
    );

    drawRainbowRule(ctx, 20, 180, 380, 8);

    const png = Buffer.from(await canvas.encode('png'));
    expect(png.byteLength).toBeGreaterThan(1024);
  });

  it('draws vignette so edges are darker than center', () => {
    const canvas = createCanvas(240, 160);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 240, 160);
    drawVignette(ctx, 240, 160, 0.8, '#000000');

    const center = ctx.getImageData(120, 80, 1, 1).data;
    const corner = ctx.getImageData(0, 0, 1, 1).data;

    const centerLuma = center[0] + center[1] + center[2];
    const cornerLuma = corner[0] + corner[1] + corner[2];

    expect(cornerLuma).toBeLessThan(centerLuma);
  });
});
