import { createHighlighter, type Highlighter, type ThemedToken } from 'shiki';

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

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return languageAliases[normalized] ?? normalized;
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
  const normalizedLanguage = normalizeLanguage(language);

  const tokens = highlighter.codeToTokensBase(code, {
    lang: normalizedLanguage as any,
    theme: themeName as any,
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
