import { Cli } from 'incur';

const cli = Cli.create('xapi', {
  description: 'X (Twitter) API CLI for spectra-the-bot.',
});

export { cli };

cli.serve();
