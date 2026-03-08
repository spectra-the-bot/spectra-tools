import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'spectra-tools',
  description:
    'Agent-friendly CLI tools for Assembly governance, Etherscan, X API, and ERC-8004 on Abstract.',
  base: '/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Agent Integration', link: '/agent-integration' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Agent Integration', link: '/agent-integration' },
        ],
      },
      {
        text: 'CLI Packages',
        items: [
          { text: 'assembly-cli', link: '/assembly/' },
          { text: 'etherscan-cli', link: '/etherscan/' },
          { text: 'xapi-cli', link: '/xapi/' },
          { text: 'erc8004-cli', link: '/erc8004/' },
        ],
      },
      {
        text: 'Command References',
        items: [
          { text: 'assembly commands', link: '/assembly/commands' },
          { text: 'etherscan commands', link: '/etherscan/commands' },
          { text: 'xapi commands', link: '/xapi/commands' },
          { text: 'erc8004 commands', link: '/erc8004/commands' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/spectra-the-bot/spectra-tools' }],
  },
});
