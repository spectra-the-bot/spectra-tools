import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { discovery } from './commands/discovery.js';
import { identity } from './commands/identity.js';
import { registration } from './commands/registration.js';
import { reputation } from './commands/reputation.js';
import { validation } from './commands/validation.js';

const cli = Cli.create('erc8004', {
  description: 'ERC-8004 Trustless Agents registry CLI.',
  version: '0.0.1',
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
  cli.serve();
}
