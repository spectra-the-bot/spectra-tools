import { describe, expect, it } from 'vitest';
import { isViemLikeError, mapContractRevertError, viemError } from '../utils/viem-errors.js';

function makeViemError(name: string, message: string, shortMessage?: string): Error {
  const err = new Error(message);
  err.name = name;
  if (shortMessage !== undefined) {
    (err as Error & { shortMessage: string }).shortMessage = shortMessage;
  }
  return err;
}

describe('isViemLikeError', () => {
  it('detects ContractFunctionExecutionError by name', () => {
    const err = makeViemError('ContractFunctionExecutionError', 'something failed');
    expect(isViemLikeError(err)).toBe(true);
  });

  it('detects ContractFunctionRevertedError by name', () => {
    const err = makeViemError('ContractFunctionRevertedError', 'reverted');
    expect(isViemLikeError(err)).toBe(true);
  });

  it('detects error with shortMessage', () => {
    const err = makeViemError('UnknownError', 'details', 'Contract function getScore reverted');
    expect(isViemLikeError(err)).toBe(true);
  });

  it('detects error with viem docs link', () => {
    const err = new Error('something Docs: https://viem.sh/docs/...');
    expect(isViemLikeError(err)).toBe(true);
  });

  it('returns false for non-Error objects', () => {
    expect(isViemLikeError('string error')).toBe(false);
    expect(isViemLikeError(null)).toBe(false);
    expect(isViemLikeError(42)).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(isViemLikeError(new Error('generic'))).toBe(false);
  });
});

describe('viemError', () => {
  it('calls c.error for viem-like errors', () => {
    const err = makeViemError('ContractFunctionRevertedError', 'getScore reverted');

    const errorSpy = { code: '', message: '' };
    const mockC = {
      error(opts: { code: string; message: string }) {
        errorSpy.code = opts.code;
        errorSpy.message = opts.message;
        throw new Error('EXIT');
      },
    };

    expect(() => viemError(mockC as never, err, { code: 'TEST', message: 'test msg' })).toThrow(
      'EXIT',
    );
    expect(errorSpy.code).toBe('TEST');
  });

  it('re-throws non-viem errors', () => {
    const err = new Error('not a viem error');

    const mockC = {
      error() {
        throw new Error('should not be called');
      },
    };

    expect(() => viemError(mockC as never, err, { code: 'TEST', message: 'test' })).toThrow(
      'not a viem error',
    );
  });
});

describe('mapContractRevertError', () => {
  function captureError(
    fn: (c: {
      error: (opts: { code: string; message: string; retryable?: boolean }) => never;
    }) => void,
  ): { code: string; message: string; retryable?: boolean } {
    let captured: { code: string; message: string; retryable?: boolean } = {
      code: '',
      message: '',
    };
    const mockC = {
      error(opts: { code: string; message: string; retryable?: boolean }): never {
        captured = opts;
        throw new Error('EXIT');
      },
    };
    try {
      fn(mockC);
    } catch {
      // expected
    }
    return captured;
  }

  it('maps getScore to AGENT_NOT_FOUND', () => {
    const err = makeViemError(
      'ContractFunctionExecutionError',
      'Contract function getScore reverted',
    );
    const result = captureError((c) => mapContractRevertError(c, err, 'getScore'));
    expect(result.code).toBe('AGENT_NOT_FOUND');
    expect(result.retryable).toBe(false);
  });

  it('maps getFeedbackCount to AGENT_NOT_FOUND', () => {
    const err = makeViemError(
      'ContractFunctionExecutionError',
      'Contract function getFeedbackCount reverted',
    );
    const result = captureError((c) => mapContractRevertError(c, err, 'getFeedbackCount'));
    expect(result.code).toBe('AGENT_NOT_FOUND');
  });

  it('maps getValidationStatus to VALIDATION_NOT_FOUND', () => {
    const err = makeViemError(
      'ContractFunctionRevertedError',
      'Contract function getValidationStatus reverted',
    );
    const result = captureError((c) => mapContractRevertError(c, err, 'getValidationStatus'));
    expect(result.code).toBe('VALIDATION_NOT_FOUND');
  });

  it('maps getValidationCount to AGENT_NOT_FOUND', () => {
    const err = makeViemError(
      'ContractFunctionExecutionError',
      'Contract function getValidationCount reverted',
    );
    const result = captureError((c) => mapContractRevertError(c, err, 'getValidationCount'));
    expect(result.code).toBe('AGENT_NOT_FOUND');
  });

  it('falls back to CONTRACT_CALL_FAILED for unknown functions', () => {
    const err = makeViemError(
      'ContractFunctionExecutionError',
      'Contract function unknownFunc reverted',
    );
    const result = captureError((c) => mapContractRevertError(c, err, 'unknownFunc'));
    expect(result.code).toBe('CONTRACT_CALL_FAILED');
  });

  it('re-throws non-viem errors', () => {
    const err = new Error('network failure');
    const mockC = {
      error(): never {
        throw new Error('should not reach');
      },
    };
    expect(() => mapContractRevertError(mockC, err, 'getScore')).toThrow('network failure');
  });
});
