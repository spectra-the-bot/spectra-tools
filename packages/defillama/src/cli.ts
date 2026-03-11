import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { feesCli } from './commands/fees.js';
import { pricesCli } from './commands/prices.js';
import { protocolsCli } from './commands/protocols.js';
import { tvlCli } from './commands/tvl.js';
import { volumeCli } from './commands/volume.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('defillama', {
  version: pkg.version,
  description: 'Query DefiLlama API data from the command line.',
});

/* ── Command groups ─────────────────────────────────────────── */

cli.command(tvlCli);
cli.command(protocolsCli);

cli.command(volumeCli);
cli.command(feesCli);

cli.command(pricesCli);

export { cli };

const PRICE_SUBCOMMANDS = new Set(['current', 'historical', 'chart']);

/**
 * Incur currently maps one positional token per args key.
 * For `prices <subcommand>`, collapse multiple coin positionals into one comma-separated token
 * so `prices current coin1 coin2` works as expected.
 */
export function normalizePricesArgv(argv: string[]): string[] {
  if (argv[0] !== 'prices') return argv;
  const subcommand = argv[1];
  if (!subcommand || !PRICE_SUBCOMMANDS.has(subcommand)) return argv;

  let i = 2;
  const coins: string[] = [];
  while (i < argv.length) {
    const token = argv[i];
    if (!token || token.startsWith('-')) break;
    coins.push(token);
    i += 1;
  }

  if (coins.length <= 1) return argv;

  return [...argv.slice(0, 2), coins.join(','), ...argv.slice(i)];
}

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
  cli.serve(normalizePricesArgv(process.argv.slice(2)));
}
