import { defineConfig } from 'vitepress';

function normalizeBase(base: string): string {
  if (base === '/') {
    return '/';
  }

  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function resolveDocsBase(): string {
  if (process.env.DOCS_BASE) {
    return normalizeBase(process.env.DOCS_BASE.trim());
  }

  const deployTarget = process.env.DOCS_DEPLOY_TARGET ?? 'custom-domain';
  return deployTarget === 'github-pages' ? '/spectra-tools/' : '/';
}

export default defineConfig({
  title: 'spectra-tools',
  description:
    'CLI tools for the Abstract ecosystem — query governance, explore chains, monitor social feeds, and discover onchain agents.',
  base: resolveDocsBase(),
  cleanUrls: true,
  head: [
    [
      'meta',
      {
        name: 'keywords',
        content:
          'Abstract, Assembly, governance, Etherscan, CLI, blockchain, AI agents, MCP, ERC-8004',
      },
    ],
    ['meta', { property: 'og:title', content: 'spectra-tools' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'CLI tools for the Abstract ecosystem — query governance, explore chains, monitor social feeds, and discover onchain agents.',
      },
    ],
  ],
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      {
        text: 'CLIs',
        items: [
          { text: '🏛️ Assembly', link: '/assembly/' },
          { text: '🔍 Etherscan', link: '/etherscan/' },
          { text: '📡 X API', link: '/xapi/' },
          { text: '🤖 ERC-8004', link: '/erc8004/' },
        ],
      },
      { text: 'Agent Integration', link: '/agent-integration' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
        ],
      },
      {
        text: 'CLIs',
        items: [
          {
            text: '🏛️ Assembly',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/assembly/' },
              { text: 'Commands', link: '/assembly/commands' },
            ],
          },
          {
            text: '🔍 Etherscan',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/etherscan/' },
              { text: 'Commands', link: '/etherscan/commands' },
            ],
          },
          {
            text: '📡 X API',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/xapi/' },
              { text: 'Commands', link: '/xapi/commands' },
            ],
          },
          {
            text: '🤖 ERC-8004',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/erc8004/' },
              { text: 'Configuration', link: '/erc8004/configuration' },
              { text: 'Commands', link: '/erc8004/commands' },
              { text: 'Guide: Agent Discovery', link: '/erc8004/guides/agent-discovery' },
              { text: 'Guide: Agent Integration', link: '/erc8004/guides/agent-integration' },
            ],
          },
        ],
      },
      {
        text: 'Integration',
        items: [
          { text: 'Agent Integration', link: '/agent-integration' },
          { text: 'Output Contract', link: '/cli-output-contract-v1' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/spectra-the-bot/spectra-tools' }],
  },
});
