import { describe, expect, it } from 'vitest';
import { registrationSchema } from '../schema.js';

describe('registrationSchema', () => {
  it('parses a minimal valid registration', () => {
    const result = registrationSchema.safeParse({ name: 'My Agent' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Agent');
    }
  });

  it('parses a full registration with services', () => {
    const data = {
      name: 'Advanced Agent',
      description: 'An advanced AI agent',
      version: '1.2.3',
      homepage: 'https://example.com',
      services: [
        {
          id: 'mcp-server',
          type: 'mcp',
          url: 'https://mcp.example.com',
          description: 'MCP endpoint',
          auth: { type: 'bearer' },
        },
      ],
      capabilities: ['code-review', 'data-analysis'],
      owner: { name: 'Alice', url: 'https://alice.example.com', contact: 'alice@example.com' },
      metadata: { custom: 'value' },
      erc8004: { version: '0.1.0', agentId: '42' },
    };

    const result = registrationSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Advanced Agent');
      expect(result.data.services).toHaveLength(1);
      expect(result.data.services?.[0]?.type).toBe('mcp');
      expect(result.data.capabilities).toEqual(['code-review', 'data-analysis']);
    }
  });

  it('fails when name is missing', () => {
    const result = registrationSchema.safeParse({ description: 'No name' });
    expect(result.success).toBe(false);
  });

  it('fails when service is missing required fields', () => {
    const result = registrationSchema.safeParse({
      name: 'Agent',
      services: [{ id: 'svc' }], // missing type and url
    });
    expect(result.success).toBe(false);
  });

  it('fails with invalid auth type', () => {
    const result = registrationSchema.safeParse({
      name: 'Agent',
      services: [
        {
          id: 'svc',
          type: 'mcp',
          url: 'https://example.com',
          auth: { type: 'invalid-auth-type' },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields as undefined', () => {
    const result = registrationSchema.safeParse({ name: 'Minimal' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.services).toBeUndefined();
      expect(result.data.capabilities).toBeUndefined();
    }
  });
});
