import { Errors } from 'incur';

/** Numeric format: plain decimal digits or 0x-prefixed hex. */
const BIGINT_PATTERN = /^(0x[0-9a-fA-F]+|[0-9]+)$/;

/**
 * Validates that {@link value} can safely convert to a `BigInt`.
 *
 * Returns the `bigint` on success.  On failure, throws an `IncurError` with
 * code `VALIDATION_ERROR` so the CLI exits cleanly instead of producing a raw
 * `Cannot convert … to a BigInt` exception.
 */
export function validateBigIntArg(value: string, argName: string): bigint {
  if (!BIGINT_PATTERN.test(value)) {
    throw new Errors.IncurError({
      code: 'VALIDATION_ERROR',
      message: `${argName} must be a numeric value`,
      retryable: false,
    });
  }
  return BigInt(value);
}
