import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initTelemetry, shutdownTelemetry } from '@spectratools/cli-shared/telemetry';
import { Cli } from 'incur';
import { commentsCli } from './commands/comments.js';
import { componentsCli } from './commands/components.js';
import { filesCli } from './commands/files.js';
import { framesCli } from './commands/frames.js';
import { nodesCli } from './commands/nodes.js';
import { tokensCli } from './commands/tokens.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('figma', {
  version: pkg.version,
  description: 'Query Figma REST API data from the command line.',
});

cli.command(tokensCli);
cli.command(componentsCli);
cli.command(filesCli);
cli.command(nodesCli);
cli.command(framesCli);
cli.command(commentsCli);

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
  initTelemetry('figma');
  process.on('beforeExit', () => shutdownTelemetry());
  cli.serve();
}
