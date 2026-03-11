import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initTelemetry, shutdownTelemetry } from '@spectratools/cli-shared/telemetry';
import { Cli } from 'incur';
import { accountCli } from './commands/account.js';
import { contractCli } from './commands/contract.js';
import { gasCli } from './commands/gas.js';
import { logsCli } from './commands/logs.js';
import { statsCli } from './commands/stats.js';
import { tokenCli } from './commands/token.js';
import { txCli } from './commands/tx.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('etherscan', {
  version: pkg.version,
  description: 'Query Etherscan API data from the command line.',
});

cli.command(accountCli);
cli.command(contractCli);
cli.command(txCli);
cli.command(tokenCli);
cli.command(gasCli);
cli.command(statsCli);
cli.command(logsCli);

export { cli };

// Only auto-serve when executed directly (not imported by tests or other modules)
const isMain = (() => {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  initTelemetry('etherscan');
  process.on('beforeExit', () => shutdownTelemetry());
  cli.serve();
}
