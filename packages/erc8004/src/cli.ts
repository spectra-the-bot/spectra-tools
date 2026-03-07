import { Cli } from 'incur';

const cli = Cli.create('erc8004', {
  description: 'ERC-8004 CLI for spectra-the-bot.',
});

export { cli };

cli.serve();
