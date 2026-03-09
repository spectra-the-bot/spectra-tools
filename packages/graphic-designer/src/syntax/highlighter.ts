import { type Highlighter, type ThemedToken, createHighlighter } from 'shiki';

let highlighterInstance: Highlighter | null = null;

const loadedThemes = [
  'github-dark-default',
  'github-light-default',
  'dracula',
  'github-dark',
  'one-dark-pro',
  'nord',
] as const;

const loadedLanguages = [
  'typescript',
  'javascript',
  'python',
  'bash',
  'json',
  'yaml',
  'rust',
  'go',
  'html',
  'css',
  'markdown',
  'sql',
  'shell',
  'plaintext',
] as const;

const languageAliases: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  sh: 'bash',
  shellscript: 'shell',
  yml: 'yaml',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
};

type LoadedTheme = (typeof loadedThemes)[number];
type LoadedLanguage = (typeof loadedLanguages)[number];

export async function initHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  highlighterInstance = await createHighlighter({
    themes: [...loadedThemes],
    langs: [...loadedLanguages],
  });

  return highlighterInstance;
}

export type HighlightedLine = {
  tokens: Array<{ text: string; color: string }>;
};

function isLoadedTheme(theme: string): theme is LoadedTheme {
  return loadedThemes.includes(theme as LoadedTheme);
}

function isLoadedLanguage(language: string): language is LoadedLanguage {
  return loadedLanguages.includes(language as LoadedLanguage);
}

function resolveLanguage(language: string): LoadedLanguage {
  const normalized =
    languageAliases[language.trim().toLowerCase()] ?? language.trim().toLowerCase();
  return isLoadedLanguage(normalized) ? normalized : 'plaintext';
}

function resolveTheme(themeName: string): LoadedTheme {
  return isLoadedTheme(themeName) ? themeName : 'github-dark-default';
}

function normalizeTokenColor(token: ThemedToken): string {
  return token.color ?? '#E2E8F0';
}

export async function highlightCode(
  code: string,
  language: string,
  themeName: string,
): Promise<HighlightedLine[]> {
  const highlighter = await initHighlighter();

  const tokens = highlighter.codeToTokensBase(code, {
    lang: resolveLanguage(language),
    theme: resolveTheme(themeName),
  });

  return tokens.map((line) => ({
    tokens: line.map((token) => ({
      text: token.content,
      color: normalizeTokenColor(token),
    })),
  }));
}

export function disposeHighlighter(): void {
  highlighterInstance?.dispose();
  highlighterInstance = null;
}
