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
