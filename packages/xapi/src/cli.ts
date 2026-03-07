import { Cli } from 'incur';
import { posts } from './commands/posts.js';
import { users } from './commands/users.js';
import { timeline } from './commands/timeline.js';
import { lists } from './commands/lists.js';
import { trends } from './commands/trends.js';
import { dm } from './commands/dm.js';

const cli = Cli.create('xapi', {
  description: 'X (Twitter) API CLI for spectra-the-bot.',
});

cli.command(posts);
cli.command(users);
cli.command(timeline);
cli.command(lists);
cli.command(trends);
cli.command(dm);

export { cli };

cli.serve();
