import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initTelemetry, shutdownTelemetry } from '@spectratools/cli-shared/telemetry';
import { Cli } from 'incur';
import { discovery } from './commands/discovery.js';
import { identity } from './commands/identity.js';
import { registration } from './commands/registration.js';
import { reputation } from './commands/reputation.js';
import { validation } from './commands/validation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('erc8004', {
  version: pkg.version,
  description: 'ERC-8004 Trustless Agents registry CLI.',
});

cli.command(identity);
cli.command(registration);
cli.command(reputation);
cli.command(validation);
cli.command(discovery);

export { cli };

// Only serve when run directly (not when imported by tests)
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
  initTelemetry('erc8004');
  process.on('beforeExit', () => shutdownTelemetry());
  cli.serve();
}
