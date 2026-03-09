import { builtInThemes, type BuiltInTheme, type Theme, type ThemeInput } from './builtin.js';

export const themeToShikiMap: Record<string, string> = {
  dark: 'github-dark-default',
  light: 'github-light-default',
  dracula: 'dracula',
  'github-dark': 'github-dark',
  'one-dark': 'one-dark-pro',
  nord: 'nord',
};

function isLightTheme(background: string): boolean {
  const hex = background.startsWith('#') ? background.slice(1) : background;
  const normalized = hex.length === 8 ? hex.slice(0, 6) : hex;

  if (!/^[0-9a-fA-F]{6}$/u.test(normalized)) {
    return false;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6;
}

function matchBuiltInTheme(theme: Theme): BuiltInTheme | undefined {
  for (const [name, builtInTheme] of Object.entries(builtInThemes) as Array<[BuiltInTheme, Theme]>) {
    if (builtInTheme === theme) {
      return name;
    }
  }

  return undefined;
}

export function resolveShikiTheme(theme: ThemeInput): string {
  if (typeof theme === 'string') {
    return themeToShikiMap[theme] ?? themeToShikiMap.dark;
  }

  const builtInName = matchBuiltInTheme(theme);
  if (builtInName) {
    return themeToShikiMap[builtInName] ?? themeToShikiMap.dark;
  }

  return isLightTheme(theme.background) ? themeToShikiMap.light : themeToShikiMap.dark;
}
