import { fileURLToPath } from 'node:url';
import { Cli } from 'incur';
import { council } from './commands/council.js';
import { forum } from './commands/forum.js';
import { members } from './commands/members.js';
import { proposals } from './commands/proposals.js';
import { votes } from './commands/votes.js';

const cli = Cli.create('assembly', {
  description: 'Assembly governance CLI for Abstract chain.',
});

cli.command(proposals);
cli.command(council);
cli.command(forum);
cli.command(members);
cli.command(votes);

export { cli };

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  cli.serve();
}
