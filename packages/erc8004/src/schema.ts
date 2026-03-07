import { z } from 'incur';

/** A service endpoint exposed by an agent. */
export const serviceSchema = z.object({
  id: z.string().describe('Unique identifier for this service'),
  type: z.string().describe('Service type (e.g. "mcp", "openapi", "webhook")'),
  url: z.string().describe('Service endpoint URL'),
  description: z.string().optional().describe('Human-readable description'),
  version: z.string().optional().describe('Service version'),
  auth: z
    .object({
      type: z.enum(['none', 'bearer', 'api-key', 'oauth2']).describe('Authentication type'),
      scheme: z.string().optional().describe('Authentication scheme details'),
    })
    .optional()
    .describe('Authentication requirements'),
});

/** ERC-8004 agent registration file schema. */
export const registrationSchema = z.object({
  name: z.string().describe('Human-readable agent name'),
  description: z.string().optional().describe('What the agent does'),
  version: z.string().optional().describe('Agent version (semver)'),
  image: z.string().optional().describe('Agent avatar/icon URL'),
  homepage: z.string().optional().describe('Agent homepage or documentation URL'),
  services: z.array(serviceSchema).optional().describe('Services the agent exposes'),
  capabilities: z
    .array(z.string())
    .optional()
    .describe('High-level capability tags (e.g. "code-review", "data-analysis")'),
  owner: z
    .object({
      name: z.string().optional().describe('Owner name'),
      url: z.string().optional().describe('Owner URL'),
      contact: z.string().optional().describe('Contact email or URL'),
    })
    .optional()
    .describe('Agent owner information'),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Arbitrary key-value metadata'),
  erc8004: z
    .object({
      version: z.string().describe('ERC-8004 spec version'),
      identityRegistry: z.string().optional().describe('Identity registry address'),
      agentId: z.string().optional().describe('Agent token ID'),
    })
    .optional()
    .describe('ERC-8004 specific fields'),
});

export type Registration = z.infer<typeof registrationSchema>;
export type Service = z.infer<typeof serviceSchema>;
