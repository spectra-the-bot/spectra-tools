import { Cli } from 'incur';

const cli = Cli.create('assembly', {
  description: 'Assembly CLI for spectra-the-bot.',
});

export { cli };

cli.serve();
