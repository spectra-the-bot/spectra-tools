import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'spectra-tools',
  description:
    'CLI tools for the Abstract ecosystem — query governance, explore chains, monitor social feeds, and discover onchain agents.',
  base: '/spectra-tools/',
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
              { text: 'Commands', link: '/erc8004/commands' },
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
