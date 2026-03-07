import { Cli } from 'incur';

const cli = Cli.create('etherscan', {
  description: 'Query Etherscan API data from the command line.',
});

export { cli };

cli.serve();
