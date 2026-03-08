import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { type XApiAuthScope, toXApiCommandError } from './auth.js';
import { dm } from './commands/dm.js';
import { lists } from './commands/lists.js';
import { posts } from './commands/posts.js';
import { timeline } from './commands/timeline.js';
import { trends } from './commands/trends.js';
import { users } from './commands/users.js';

const cli = Cli.create('xapi', {
  description: 'X (Twitter) API CLI for spectra-the-bot.',
});

const WRITE_OPERATIONS = new Set(['posts create', 'posts delete', 'dm send']);

cli.use(async ({ command, error }, next) => {
  try {
    return await next();
  } catch (cause) {
    const authScope: XApiAuthScope = WRITE_OPERATIONS.has(command) ? 'write' : 'read';
    const mapped = toXApiCommandError(command, cause, authScope);

    if (mapped) {
      return error(mapped);
    }

    throw cause;
  }
});

cli.command(posts);
cli.command(users);
cli.command(timeline);
cli.command(lists);
cli.command(trends);
cli.command(dm);

export { cli };

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
