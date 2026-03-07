import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { accountCli } from './commands/account.js';
import { contractCli } from './commands/contract.js';
import { txCli } from './commands/tx.js';
import { tokenCli } from './commands/token.js';
import { gasCli } from './commands/gas.js';
import { statsCli } from './commands/stats.js';

const cli = Cli.create('etherscan', {
  description: 'Query Etherscan API data from the command line.',
});

cli.command(accountCli);
cli.command(contractCli);
cli.command(txCli);
cli.command(tokenCli);
cli.command(gasCli);
cli.command(statsCli);

export { cli };

// Only auto-serve when executed directly (not imported by tests or other modules)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.serve();
}
