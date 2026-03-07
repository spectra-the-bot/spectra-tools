import { apiKeyAuth, paginateCursor } from '@spectra-the-bot/cli-shared';
import { Cli, z } from 'incur';
import { createXApiClient } from '../api.js';

const dm = Cli.create('dm', {
  description: 'Manage X direct messages.',
});

dm.command('conversations', {
  description: 'List your DM conversations.',
  options: z.object({
    maxResults: z.number().default(20).describe('Maximum conversations to return'),
  }),
  alias: { maxResults: 'n' },
  output: z.object({
    conversations: z.array(
      z.object({
        dm_conversation_id: z.string(),
        participant_ids: z.array(z.string()),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ description: 'List your DM conversations' }],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const meRes = await client.getMe();
    const userId = meRes.data.id;
    const allConvos: Array<{ dm_conversation_id: string; participant_ids: string[] }> = [];

    for await (const convo of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getDmConversations(
          userId,
          Math.min(c.options.maxResults, 100),
          cursor ?? undefined,
        );
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allConvos.push({
        dm_conversation_id: convo.dm_conversation_id,
        participant_ids: convo.participant_ids,
      });
      if (allConvos.length >= c.options.maxResults) break;
    }

    const firstParticipant = allConvos[0]?.participant_ids[0];
    return c.ok(
      { conversations: allConvos, count: allConvos.length },
      {
        cta: firstParticipant
          ? {
              description: 'Next steps:',
              commands: [
                {
                  command: 'dm send',
                  args: { participantId: firstParticipant },
                  options: { text: 'Hello!' },
                  description: 'Send a message to the first conversation',
                },
              ],
            }
          : undefined,
      },
    );
  },
});

dm.command('send', {
  description: 'Send a direct message to a user.',
  args: z.object({
    participantId: z.string().describe('User ID to send message to'),
  }),
  options: z.object({
    text: z.string().describe('Message text'),
  }),
  output: z.object({
    dm_conversation_id: z.string(),
    dm_event_id: z.string(),
  }),
  examples: [
    {
      args: { participantId: '12345' },
      options: { text: 'Hey there!' },
      description: 'Send a DM to a user',
    },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const res = await client.sendDm(c.args.participantId, c.options.text);
    return c.ok(res.data);
  },
});

export { dm };
