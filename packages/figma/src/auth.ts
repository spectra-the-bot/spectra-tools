import { z } from 'incur';

export const figmaEnv = z.object({
  FIGMA_API_KEY: z.string().describe('Figma personal access token'),
});
