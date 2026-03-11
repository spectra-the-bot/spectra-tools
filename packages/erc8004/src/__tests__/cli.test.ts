import { describe, expect, it } from 'vitest';
import { cli } from '../cli.js';

describe('erc8004 cli', () => {
  it('returns help output', async () => {
    let output = '';
    await cli.serve(['--help'], {
      stdout(s) {
        output += s;
      },
      exit() {},
    });
    expect(output).toContain('erc8004');
  });

  it('reputation feedback errors without private key', async () => {
    let output = '';
    await cli.serve(['reputation', 'feedback', '1', '--value', '10', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        REPUTATION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
        PRIVATE_KEY: undefined,
      },
    });

    // incur emits the error object directly (not wrapped) in non-verbose --json mode
    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('validation request errors without private key', async () => {
    let output = '';
    await cli.serve(
      [
        'validation',
        'request',
        '1',
        '--validator',
        '0x1234567890123456789012345678901234567890',
        '--job-hash',
        `0x${'00'.repeat(32)}`,
        '--json',
      ],
      {
        stdout(s) {
          output += s;
        },
        exit() {},
        env: {
          VALIDATION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
          PRIVATE_KEY: undefined,
        },
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('identity register errors without private key', async () => {
    let output = '';
    await cli.serve(['identity', 'register', '--uri', 'https://example.com/agent.json', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
        PRIVATE_KEY: undefined,
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('discovery resolve errors on invalid identifier', async () => {
    let output = '';
    await cli.serve(['discovery', 'resolve', 'invalid-no-colon', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {},
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('INVALID_IDENTIFIER');
  });

  it('identity get errors on non-numeric agentId', async () => {
    let output = '';
    await cli.serve(['identity', 'get', 'notanumber', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('agentId must be a numeric value');
  });

  it('identity get errors on non-numeric --id flag', async () => {
    let output = '';
    await cli.serve(['identity', 'get', '--id', 'notanumber', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('agentId must be a numeric value');
  });

  it('identity get errors when no agentId is provided', async () => {
    let output = '';
    await cli.serve(['identity', 'get', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('MISSING_AGENT_ID');
    expect(envelope.message).toContain('Agent ID is required');
  });

  it('reputation get errors on non-numeric agentId', async () => {
    let output = '';
    await cli.serve(['reputation', 'get', 'abc', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        REPUTATION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('agentId must be a numeric value');
  });

  it('validation history errors on non-numeric agentId', async () => {
    let output = '';
    await cli.serve(['validation', 'history', '0xinvalid', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        VALIDATION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('agentId must be a numeric value');
  });

  it('discovery resolve errors on non-numeric agentId in identifier', async () => {
    let output = '';
    await cli.serve(
      ['discovery', 'resolve', '0x1234567890123456789012345678901234567890:notanumber', '--json'],
      {
        stdout(s) {
          output += s;
        },
        exit() {},
        env: {},
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('agentId must be a numeric value');
  });

  it('identity burn returns BURN_NOT_SUPPORTED error', async () => {
    let output = '';
    await cli.serve(['identity', 'burn', '1', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('BURN_NOT_SUPPORTED');
    expect(envelope.message).toContain('does not support burn');
    expect(envelope.retryable).toBe(false);
  });

  it('identity burn returns BURN_NOT_SUPPORTED even with --confirm and --dry-run', async () => {
    let output = '';
    await cli.serve(['identity', 'burn', '1', '--confirm', '--dry-run', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('BURN_NOT_SUPPORTED');
  });

  it('validation submit-result errors without private key', async () => {
    let output = '';
    await cli.serve(
      [
        'validation',
        'submit-result',
        '1',
        '--status',
        'pass',
        '--result',
        'All checks passed',
        '--json',
      ],
      {
        stdout(s) {
          output += s;
        },
        exit() {},
        env: {
          VALIDATION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
          PRIVATE_KEY: undefined,
        },
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('validation cancel errors without private key', async () => {
    let output = '';
    await cli.serve(['validation', 'cancel', '1', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
      env: {
        VALIDATION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
        PRIVATE_KEY: undefined,
      },
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('registration create --json output does not contain CTA keys', async () => {
    let output = '';
    await cli.serve(['registration', 'create', '--name', 'Test Agent', '--json'], {
      stdout(s) {
        output += s;
      },
      exit() {},
    });

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('name', 'Test Agent');
    expect(parsed).not.toHaveProperty('cta');
  });
});
