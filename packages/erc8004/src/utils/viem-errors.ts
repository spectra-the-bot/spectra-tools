/**
 * Shared viem error detection and mapping utilities for ERC-8004 CLI commands.
 */

const VIEM_ERROR_NAMES = new Set([
  'AbiFunctionNotFoundError',
  'CallExecutionError',
  'ContractFunctionExecutionError',
  'ContractFunctionRevertedError',
  'HttpRequestError',
  'InvalidAddressError',
  'TransactionExecutionError',
]);

type CliErrorContext = {
  error: (options: { code: string; message: string; retryable?: boolean }) => never;
};

/**
 * Returns true if {@link error} looks like a viem-originated error.
 */
export function isViemLikeError(error: unknown): error is Error & { shortMessage?: string } {
  if (!(error instanceof Error)) {
    return false;
  }

  const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
  return (
    VIEM_ERROR_NAMES.has(error.name) ||
    (typeof shortMessage === 'string' && shortMessage.length > 0) ||
    error.message.includes('Docs: https://viem.sh') ||
    error.message.includes('Version: viem@')
  );
}

/**
 * Returns true if the error indicates ERC-721 enumeration is unsupported.
 */
export function isEnumerableFailure(error: unknown): boolean {
  if (!isViemLikeError(error)) {
    return false;
  }

  const shortMessage =
    typeof error.shortMessage === 'string' && error.shortMessage.trim().length > 0
      ? error.shortMessage
      : '';
  const text = `${error.name} ${shortMessage} ${error.message}`.toLowerCase();

  return (
    text.includes('totalsupply') ||
    text.includes('tokenbyindex') ||
    text.includes('tokenofownerbyindex') ||
    text.includes('enumerable') ||
    text.includes('function does not exist')
  );
}

/**
 * Calls `c.error()` when the error is viem-like, otherwise re-throws.
 */
export function viemError(
  c: CliErrorContext,
  error: unknown,
  fallback: { code: string; message: string; retryable?: boolean },
): never {
  if (isViemLikeError(error)) {
    return c.error(fallback);
  }

  throw error;
}

/**
 * Error code mapping for known contract function reverts in reputation / validation commands.
 */
const CONTRACT_REVERT_MAP: Record<string, { code: string; message: string }> = {
  getScore: {
    code: 'AGENT_NOT_FOUND',
    message:
      'No reputation data found for this agent. The agent may not have received any feedback yet.',
  },
  getFeedbackCount: {
    code: 'AGENT_NOT_FOUND',
    message:
      'No feedback history found for this agent. The agent may not exist or has no feedback records.',
  },
  getValidationStatus: {
    code: 'VALIDATION_NOT_FOUND',
    message: 'No validation request found with this ID. The request may not exist.',
  },
  getValidationCount: {
    code: 'AGENT_NOT_FOUND',
    message:
      'No validation history found for this agent. The agent may not have any validation requests.',
  },
};

/**
 * Maps a contract revert error to a structured error code based on the function name.
 *
 * If the error is a viem-like error, uses {@link CONTRACT_REVERT_MAP} to find a friendly
 * code for the given {@link functionName}, falling back to `CONTRACT_CALL_FAILED`.
 * Non-viem errors are re-thrown.
 */
export function mapContractRevertError(
  c: CliErrorContext,
  error: unknown,
  functionName: string,
): never {
  const mapped = CONTRACT_REVERT_MAP[functionName];
  const fallback = mapped ?? {
    code: 'CONTRACT_CALL_FAILED',
    message:
      'Contract call failed. The registry contract may not be initialized or the agent ID may be invalid.',
  };

  return viemError(c, error, { ...fallback, retryable: false });
}
