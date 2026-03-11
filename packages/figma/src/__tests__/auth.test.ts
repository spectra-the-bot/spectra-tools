import { describe, expect, it } from 'vitest';
import { figmaEnv } from '../auth.js';

describe('figmaEnv', () => {
  it('passes when FIGMA_API_KEY is present', () => {
    const result = figmaEnv.safeParse({ FIGMA_API_KEY: 'figd_abc123' });
    expect(result.success).toBe(true);
  });

  it('fails when FIGMA_API_KEY is missing', () => {
    const result = figmaEnv.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('FIGMA_API_KEY');
    }
  });

  it('fails when FIGMA_API_KEY is not a string', () => {
    const result = figmaEnv.safeParse({ FIGMA_API_KEY: 123 });
    expect(result.success).toBe(false);
  });
});
