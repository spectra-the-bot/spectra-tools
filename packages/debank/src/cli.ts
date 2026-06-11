import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initTelemetry, shutdownTelemetry } from '@spectratools/cli-shared/telemetry';
import { Cli } from 'incur';
import { chainCli } from './commands/chain.js';
import { collectionCli } from './commands/collection.js';
import { protocolCli } from './commands/protocol.js';
import { poolCli, tokenCli } from './commands/token.js';
import { userCli } from './commands/user.js';
import { walletCli } from './commands/wallet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('debank', {
  version: pkg.version,
  description:
    'Query DeBank Pro API data — chains, protocols, tokens, pools, wallets, and tx simulation.',
});

cli.command(chainCli);
cli.command(protocolCli);
cli.command(tokenCli);
cli.command(poolCli);
cli.command(userCli);
cli.command(collectionCli);
cli.command(walletCli);

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
  initTelemetry('debank');
  process.on('beforeExit', () => shutdownTelemetry());
  cli.serve();
}
