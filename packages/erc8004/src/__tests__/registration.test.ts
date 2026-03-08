import { describe, expect, it, vi } from 'vitest';
import { cli } from '../cli.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('registration create', () => {
  it('generates a minimal registration file', async () => {
    let output = '';
    await cli.serve(['registration', 'create', '--name', 'Test Agent', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
    });

    // Without --verbose, incur emits data directly (no ok wrapper)
    const data = JSON.parse(output);
    expect(data.name).toBe('Test Agent');
    expect(data.erc8004.version).toBe('0.1.0');
  });

  it('includes optional fields when provided', async () => {
    let output = '';
    await cli.serve(
      [
        'registration',
        'create',
        '--name',
        'Full Agent',
        '--description',
        'A full agent',
        '--agent-version',
        '2.0.0',
        '--json',
      ],
      {
        stdout(s) {
          output += s;
        },
        exit() {},
      },
    );

    const data = JSON.parse(output);
    expect(data.name).toBe('Full Agent');
    expect(data.description).toBe('A full agent');
    expect(data.version).toBe('2.0.0');
  });
});

describe('registration validate', () => {
  it('validates a data: URI registration file', async () => {
    const reg = JSON.stringify({ name: 'Data Agent', erc8004: { version: '0.1.0' } });
    const dataUri = `data:application/json,${encodeURIComponent(reg)}`;

    let output = '';
    await cli.serve(['registration', 'validate', dataUri, '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
    });

    const data = JSON.parse(output);
    expect(data.valid).toBe(true);
    expect(data.registration?.name).toBe('Data Agent');
  });

  it('uses IPFS_GATEWAY override for ipfs:// URIs', async () => {
    const previousGateway = process.env.IPFS_GATEWAY;
    const mockFetch = vi.fn<typeof fetch>();

    try {
      process.env.IPFS_GATEWAY = 'https://gateway.example/';
      vi.stubGlobal('fetch', mockFetch);
      mockFetch.mockResolvedValue(
        makeJsonResponse({ name: 'IPFS Agent', erc8004: { version: '0.1.0' } }),
      );

      let output = '';
      await cli.serve(
        ['registration', 'validate', 'ipfs://bafybeihash/registration.json', '--json'],
        {
          stdout(s) {
            output += s;
          },
          exit() {},
        },
      );

      const data = JSON.parse(output);
      expect(data.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gateway.example/ipfs/bafybeihash/registration.json',
      );
    } finally {
      vi.unstubAllGlobals();
      process.env.IPFS_GATEWAY = previousGateway;
    }
  });

  it('validates ERC-8004 registration when optional trust fields are omitted', async () => {
    const reg = JSON.stringify({
      name: 'Spec Agent',
      services: [{ name: 'A2A', endpoint: 'https://agent.example/.well-known/agent-card.json' }],
    });
    const dataUri = `data:application/json,${encodeURIComponent(reg)}`;

    let output = '';
    await cli.serve(['registration', 'validate', dataUri, '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
    });

    const data = JSON.parse(output);
    expect(data.valid).toBe(true);
    expect(data.registration?.x402Support).toBeUndefined();
    expect(data.registration?.supportedTrust).toBeUndefined();
  });

  it('reports errors for invalid registration', async () => {
    // Missing required "name" field
    const reg = JSON.stringify({ description: 'No name' });
    const dataUri = `data:application/json,${encodeURIComponent(reg)}`;

    let output = '';
    await cli.serve(['registration', 'validate', dataUri, '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
    });

    const data = JSON.parse(output);
    expect(data.valid).toBe(false);
    expect(data.errors).toBeDefined();
    expect(data.errors?.length).toBeGreaterThan(0);
  });
});
