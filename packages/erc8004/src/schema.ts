import { z } from 'incur';

/** A service endpoint exposed by an agent. */
export const serviceSchema = z
  .object({
    id: z.string().optional().describe('Unique identifier for this service (legacy field)'),
    type: z.string().optional().describe('Service type (e.g. "mcp", "openapi", "webhook")'),
    url: z.string().optional().describe('Service endpoint URL (legacy field)'),
    name: z.string().optional().describe('Service name from the ERC-8004 registration format'),
    endpoint: z
      .string()
      .optional()
      .describe('Service endpoint from the ERC-8004 registration format'),
    description: z.string().optional().describe('Human-readable description'),
    version: z.string().optional().describe('Service version'),
    x402: z.unknown().optional().describe('Optional x402 payment metadata for this service'),
    auth: z
      .object({
        type: z.enum(['none', 'bearer', 'api-key', 'oauth2']).describe('Authentication type'),
        scheme: z.string().optional().describe('Authentication scheme details'),
      })
      .optional()
      .describe('Authentication requirements'),
  })
  .refine(
    (service) =>
      Boolean(
        (service.id && service.type && service.url) ||
          // ERC-8004 registration format
          (service.name && service.endpoint),
      ),
    {
      message: 'Service must include either (id, type, url) or (name, endpoint)',
    },
  );

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
  metadata: z.record(z.string(), z.string()).optional().describe('Arbitrary key-value metadata'),
  x402Support: z.boolean().optional().describe('Optional x402 support flag'),
  supportedTrust: z
    .array(z.string())
    .optional()
    .describe('Optional trust mechanisms supported by the agent'),
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
