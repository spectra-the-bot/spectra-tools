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
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  cli.serve();
}
