import { z } from 'incur';
import type { SignerOptions } from './types.js';

/** Shared signer-related CLI flags for write-capable commands. */
export const signerFlagSchema = z.object({
  'private-key': z
    .string()
    .optional()
    .describe('Raw private key (0x-prefixed 32-byte hex) for signing transactions'),
  keystore: z.string().optional().describe('Path to an encrypted V3 keystore JSON file'),
  password: z.string().optional().describe('Keystore password (non-interactive mode)'),
  privy: z.boolean().default(false).describe('Use Privy server wallet signer mode'),
  'privy-api-url': z
    .string()
    .optional()
    .describe('Override Privy API base URL (defaults to https://api.privy.io)'),
});

/** Shared signer-related environment variables for write-capable commands. */
export const signerEnvSchema = z.object({
  PRIVATE_KEY: z.string().optional().describe('Raw private key (0x-prefixed 32-byte hex)'),
  KEYSTORE_PASSWORD: z.string().optional().describe('Password for decrypting --keystore'),
  PRIVY_APP_ID: z.string().optional().describe('Privy app id used to authorize wallet intents'),
  PRIVY_WALLET_ID: z.string().optional().describe('Privy wallet id used for transaction intents'),
  PRIVY_AUTHORIZATION_KEY: z
    .string()
    .optional()
    .describe('Privy authorization private key used to sign intent requests'),
  PRIVY_API_URL: z
    .string()
    .optional()
    .describe('Optional Privy API base URL override (default https://api.privy.io)'),
});

export type SignerFlags = z.infer<typeof signerFlagSchema>;
export type SignerEnv = z.infer<typeof signerEnvSchema>;

/** Map parsed CLI context into tx-shared SignerOptions. */
export function toSignerOptions(flags: SignerFlags, env: SignerEnv): SignerOptions {
  const privateKey = flags['private-key'] ?? env.PRIVATE_KEY;
  const keystorePassword = flags.password ?? env.KEYSTORE_PASSWORD;
  const privyApiUrl = flags['privy-api-url'] ?? env.PRIVY_API_URL;

  return {
    ...(privateKey !== undefined ? { privateKey } : {}),
    ...(flags.keystore !== undefined ? { keystorePath: flags.keystore } : {}),
    ...(keystorePassword !== undefined ? { keystorePassword } : {}),
    ...(flags.privy ? { privy: true } : {}),
    ...(env.PRIVY_APP_ID !== undefined ? { privyAppId: env.PRIVY_APP_ID } : {}),
    ...(env.PRIVY_WALLET_ID !== undefined ? { privyWalletId: env.PRIVY_WALLET_ID } : {}),
    ...(env.PRIVY_AUTHORIZATION_KEY !== undefined
      ? { privyAuthorizationKey: env.PRIVY_AUTHORIZATION_KEY }
      : {}),
    ...(privyApiUrl !== undefined ? { privyApiUrl } : {}),
  };
}
