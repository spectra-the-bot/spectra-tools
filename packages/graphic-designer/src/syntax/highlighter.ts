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

/**
 * Initialise (or return the existing) shiki syntax highlighter singleton.
 *
 * Loads all bundled themes and languages on first call. Subsequent calls return
 * the cached instance immediately. Must be called (or allowed to be called
 * implicitly via {@link highlightCode}) before any syntax highlighting work.
 *
 * @returns The shared shiki {@link Highlighter} instance.
 */
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

  if (!isLoadedLanguage(normalized)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return normalized;
}

function resolveTheme(themeName: string): LoadedTheme {
  if (!isLoadedTheme(themeName)) {
    throw new Error(`Unsupported theme: ${themeName}`);
  }

  return themeName;
}

function normalizeTokenColor(token: ThemedToken): string {
  return token.color ?? '#E2E8F0';
}

/**
 * Tokenise and syntax-highlight a code string.
 *
 * Lazily initialises the highlighter via {@link initHighlighter} if it has not
 * been created yet. Language aliases (e.g. `"ts"` → `"typescript"`) are
 * resolved automatically.
 *
 * @param code - The source code string to highlight.
 * @param language - Programming language identifier or alias (e.g.
 *   `"typescript"`, `"ts"`, `"python"`).
 * @param themeName - Shiki theme name to use for colouring (e.g.
 *   `"github-dark"`).
 * @returns An array of {@link HighlightedLine} objects, one per line, each
 *   containing an array of coloured text tokens.
 * @throws When the language or theme is not among the bundled set.
 */
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

/**
 * Dispose the shared shiki highlighter instance and release its resources.
 *
 * After disposal, the next call to {@link initHighlighter} or
 * {@link highlightCode} will create a fresh instance. Safe to call even when no
 * highlighter has been initialised (no-op in that case).
 */
export function disposeHighlighter(): void {
  highlighterInstance?.dispose();
  highlighterInstance = null;
}
