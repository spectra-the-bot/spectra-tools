import { z } from 'incur';

export const debankEnv = z.object({
  ACCESS_KEY: z.string().describe('DeBank Pro API AccessKey (https://pro.debank.com/)'),
});
