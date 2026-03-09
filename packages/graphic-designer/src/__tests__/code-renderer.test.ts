import { createCanvas } from '@napi-rs/canvas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCodeBlock } from '../renderers/code.js';
import { highlightCode } from '../syntax/highlighter.js';
import { resolveTheme } from '../themes/index.js';

vi.mock('../syntax/highlighter.js', () => ({
  highlightCode: vi.fn(),
}));

const mockedHighlightCode = vi.mocked(highlightCode);

describe('code block renderer', () => {
  beforeEach(() => {
    mockedHighlightCode.mockReset();
  });

  it('renders highlighted token output when shiki succeeds', async () => {
    mockedHighlightCode.mockResolvedValue([
      {
        tokens: [
          { text: 'alpha', color: '#FF0000' },
          { text: 'beta', color: '#00FF00' },
        ],
      },
    ]);

    const theme = resolveTheme('dark');
    const ctx = createCanvas(800, 400).getContext('2d');
    const fillSpy = vi.spyOn(ctx, 'fillText');

    await renderCodeBlock(
      ctx,
      {
        type: 'code-block',
        id: 'code1',
        code: 'alpha beta',
        language: 'typescript',
        showLineNumbers: false,
        startLine: 1,
      },
      { x: 40, y: 40, width: 320, height: 200 },
      theme,
    );

    expect(mockedHighlightCode).toHaveBeenCalledWith('alpha beta', 'typescript', 'github-dark-default');
    const drawnText = fillSpy.mock.calls.map(([text]) => String(text));
    expect(drawnText).toContain('alpha');
    expect(drawnText).toContain('beta');
  });

  it('falls back to plain monospace rendering when highlighting fails', async () => {
    mockedHighlightCode.mockRejectedValue(new Error('unsupported language'));

    const theme = resolveTheme('dark');
    const ctx = createCanvas(800, 400).getContext('2d');
    const fillSpy = vi.spyOn(ctx, 'fillText');

    const rendered = await renderCodeBlock(
      ctx,
      {
        type: 'code-block',
        id: 'code2',
        code: 'console.log("fallback")',
        language: 'madeuplang',
        showLineNumbers: false,
        startLine: 1,
      },
      { x: 40, y: 40, width: 320, height: 200 },
      theme,
    );

    expect(rendered).toHaveLength(2);
    const drawnText = fillSpy.mock.calls.map(([text]) => String(text));
    expect(drawnText).toContain('console');
    expect(drawnText).toContain('log');
    expect(drawnText).toContain('"fallback"');
  });

  it('uses custom code theme overrides when provided on the block', async () => {
    mockedHighlightCode.mockResolvedValue([
      {
        tokens: [{ text: 'x', color: '#FFFFFF' }],
      },
    ]);

    const theme = resolveTheme('dark');
    const ctx = createCanvas(800, 400).getContext('2d');

    await renderCodeBlock(
      ctx,
      {
        type: 'code-block',
        id: 'code3',
        code: 'x',
        language: 'typescript',
        theme: 'nord',
        showLineNumbers: false,
        startLine: 1,
      },
      { x: 40, y: 40, width: 320, height: 200 },
      theme,
    );

    expect(mockedHighlightCode).toHaveBeenCalledWith('x', 'typescript', 'nord');
  });

  it('applies drop shadow when enabled', async () => {
    mockedHighlightCode.mockResolvedValue([{ tokens: [{ text: 'x', color: '#FFFFFF' }] }]);
    const theme = resolveTheme('dark');

    const withShadow = createCanvas(420, 260);
    const withShadowCtx = withShadow.getContext('2d');
    await renderCodeBlock(
      withShadowCtx,
      {
        type: 'code-block',
        id: 'shadow-on',
        code: 'x',
        language: 'typescript',
        showLineNumbers: false,
        startLine: 1,
        style: {
          dropShadow: true,
          windowControls: 'none',
          surroundColor: '#FFFFFF',
          paddingHorizontal: 32,
          paddingVertical: 32,
          scale: 1,
        },
      },
      { x: 20, y: 20, width: 360, height: 220 },
      theme,
    );

    const withoutShadow = createCanvas(420, 260);
    const withoutShadowCtx = withoutShadow.getContext('2d');
    await renderCodeBlock(
      withoutShadowCtx,
      {
        type: 'code-block',
        id: 'shadow-off',
        code: 'x',
        language: 'typescript',
        showLineNumbers: false,
        startLine: 1,
        style: {
          dropShadow: false,
          windowControls: 'none',
          surroundColor: '#FFFFFF',
          paddingHorizontal: 32,
          paddingVertical: 32,
          scale: 1,
        },
      },
      { x: 20, y: 20, width: 360, height: 220 },
      theme,
    );

    const withShadowPixel = withShadowCtx.getImageData(200, 216, 1, 1).data;
    const withoutShadowPixel = withoutShadowCtx.getImageData(200, 216, 1, 1).data;
    const withShadowLuma = withShadowPixel[0] + withShadowPixel[1] + withShadowPixel[2];
    const withoutShadowLuma = withoutShadowPixel[0] + withoutShadowPixel[1] + withoutShadowPixel[2];

    expect(withShadowLuma).toBeLessThan(withoutShadowLuma);
  });

  it('skips chrome text when window controls are disabled', async () => {
    mockedHighlightCode.mockResolvedValue([{ tokens: [{ text: 'hello', color: '#FFFFFF' }] }]);

    const theme = resolveTheme('dark');
    const ctx = createCanvas(420, 260).getContext('2d');
    const fillSpy = vi.spyOn(ctx, 'fillText');

    await renderCodeBlock(
      ctx,
      {
        type: 'code-block',
        id: 'code-none',
        code: 'hello',
        language: 'typescript',
        showLineNumbers: false,
        startLine: 1,
        style: {
          windowControls: 'none',
          scale: 1,
        },
      },
      { x: 20, y: 20, width: 360, height: 220 },
      theme,
    );

    const drawnText = fillSpy.mock.calls.map(([text]) => String(text));
    expect(drawnText).not.toContain('typescript');
    expect(drawnText).toContain('hello');
  });
});
