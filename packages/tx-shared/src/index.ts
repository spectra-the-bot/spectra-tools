export * from './types.js';
export * from './errors.js';
export * from './chain.js';
export * from './execute-tx.js';
export * from './resolve-signer.js';
export * from './incur-params.js';
export * from './signers/index.js';

// Re-export span helpers for transaction tracing consumers.
export {
  withSpan,
  recordError,
  sanitizeAttributes,
} from '@spectratools/cli-shared/telemetry';
