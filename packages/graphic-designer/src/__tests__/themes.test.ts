import { describe, expect, it } from 'vitest';
import { builtInThemes, resolveShikiTheme, themeToShikiMap } from '../themes/index.js';

describe('theme to shiki mapping', () => {
  it('maps built-in theme names to shiki themes', () => {
    expect(resolveShikiTheme('dark')).toBe('github-dark-default');
    expect(resolveShikiTheme('light')).toBe('github-light-default');
    expect(resolveShikiTheme('dracula')).toBe('dracula');
    expect(resolveShikiTheme('github-dark')).toBe('github-dark');
    expect(resolveShikiTheme('one-dark')).toBe('one-dark-pro');
    expect(resolveShikiTheme('nord')).toBe('nord');
  });

  it('maps resolved built-in theme objects to the same shiki themes', () => {
    expect(resolveShikiTheme(builtInThemes.dark)).toBe(themeToShikiMap.dark);
    expect(resolveShikiTheme(builtInThemes.light)).toBe(themeToShikiMap.light);
  });

  it('falls back based on custom theme brightness', () => {
    const lightTheme = {
      ...builtInThemes.dark,
      background: '#FFFFFF',
    };

    expect(resolveShikiTheme(lightTheme)).toBe('github-light-default');
  });
});
