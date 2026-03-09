import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { type XApiAuthScope, toXApiCommandError } from './auth.js';
import { dm } from './commands/dm.js';
import { lists } from './commands/lists.js';
import { posts } from './commands/posts.js';
import { timeline } from './commands/timeline.js';
import { trends } from './commands/trends.js';
import { users } from './commands/users.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('xapi', {
  version: pkg.version,
  description: 'X (Twitter) API CLI for spectra-the-bot.',
});

const WRITE_OPERATIONS = new Set([
  'posts create',
  'posts delete',
  'posts like',
  'posts unlike',
  'posts bookmark',
  'posts unbookmark',
  'posts retweet',
  'users follow',
  'users unfollow',
  'users block',
  'users unblock',
  'users mute',
  'users unmute',
  'lists create',
  'lists delete',
  'lists add-member',
  'lists remove-member',
  'dm send',
]);

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
