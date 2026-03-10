import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { tvlCli } from './commands/tvl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('defillama', {
  version: pkg.version,
  description: 'Query DefiLlama API data from the command line.',
});

/* ── Command groups ─────────────────────────────────────────── */

cli.command(tvlCli);

const volumeCli = Cli.create('volume', {
  description: 'DEX volume queries.',
});
cli.command(volumeCli);

const feesCli = Cli.create('fees', {
  description: 'Protocol fees and revenue queries.',
});
cli.command(feesCli);

const pricesCli = Cli.create('prices', {
  description: 'Token price queries.',
});
cli.command(pricesCli);

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
  cli.serve();
}
