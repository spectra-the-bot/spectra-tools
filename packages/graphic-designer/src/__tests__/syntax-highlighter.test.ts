import { afterEach, describe, expect, it } from 'vitest';
import { disposeHighlighter, highlightCode, initHighlighter } from '../syntax/highlighter.js';

afterEach(() => {
  disposeHighlighter();
});

describe('syntax highlighter', () => {
  it('initializes highlighter once and reuses the cached instance', async () => {
    const first = await initHighlighter();
    const second = await initHighlighter();

    expect(second).toBe(first);
  });

  it('returns themed tokens for highlighted code', async () => {
    const lines = await highlightCode('const answer = 42;', 'typescript', 'github-dark-default');

    expect(lines).toHaveLength(1);
    expect(lines[0].tokens.length).toBeGreaterThan(0);
    expect(lines[0].tokens.every((token) => token.color.length > 0)).toBe(true);
  });

  it('throws for unsupported languages so renderer can fall back safely', async () => {
    await expect(
      highlightCode('const answer = 42;', 'definitely-not-a-real-language', 'github-dark-default'),
    ).rejects.toThrow();
  });
});
