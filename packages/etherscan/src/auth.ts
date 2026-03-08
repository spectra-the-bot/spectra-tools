import { z } from 'incur';

export const etherscanEnv = z.object({
  ETHERSCAN_API_KEY: z.string().describe('Etherscan V2 API key'),
});
