export type TxErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'NONCE_CONFLICT'
  | 'TX_REVERTED'
  | 'GAS_ESTIMATION_FAILED'
  | 'SIGNER_NOT_CONFIGURED'
  | 'KEYSTORE_DECRYPT_FAILED'
  | 'PRIVY_AUTH_FAILED'
  | 'PRIVY_TRANSPORT_FAILED';

export class TxError extends Error {
  public readonly code: TxErrorCode;

  public constructor(code: TxErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TxError';
    this.code = code;
  }
}

export function toTxError(code: TxErrorCode, message: string, cause?: unknown): TxError {
  return new TxError(code, message, cause);
}
