import { builtInThemes, type Theme, type ThemeInput } from './builtin.js';

export * from './builtin.js';
export * from './syntax.js';

export function resolveTheme(theme: ThemeInput): Theme {
  if (typeof theme === 'string') {
    return builtInThemes[theme];
  }

  return theme;
}
