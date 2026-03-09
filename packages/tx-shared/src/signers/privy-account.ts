import {
  type Address,
  type Hash,
  type Hex,
  type SerializeTransactionFn,
  type SignableMessage,
  type TransactionSerializable,
  type TypedData,
  type TypedDataDefinition,
  isAddress,
  toHex,
} from 'viem';
import { TxError } from '../errors.js';
import type { PrivyClient, PrivyRpcIntentRequest, PrivyRpcIntentResponse } from './privy-client.js';

const DEFAULT_CHAIN_ID = 2741;
const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const HEX_REGEX = /^0x(?:[a-fA-F0-9]{2})+$/;

type PrivyNumberish = bigint | number | string;

export interface PrivySendTransactionRequest {
  from?: Address;
  to?: Address;
  data?: Hex;
  value?: PrivyNumberish;
  nonce?: PrivyNumberish;
  gas?: PrivyNumberish;
  gasPrice?: PrivyNumberish;
  maxFeePerGas?: PrivyNumberish;
  maxPriorityFeePerGas?: PrivyNumberish;
  chainId?: PrivyNumberish;
  type?: number;
}

export type PrivySignTransactionRequest = PrivySendTransactionRequest;

export type PrivySignTypedDataRequest<
  typedData extends TypedData | Record<string, unknown> = TypedData,
  primaryType extends keyof typedData | 'EIP712Domain' = keyof typedData,
> = TypedDataDefinition<typedData, primaryType>;

export interface PrivyAccount {
  address: Address;
  type: 'json-rpc';
  sendTransaction: (request: PrivySendTransactionRequest) => Promise<Hash>;
  signMessage: ({ message }: { message: SignableMessage }) => Promise<Hex>;
  signTypedData: <
    const typedData extends TypedData | Record<string, unknown>,
    primaryType extends keyof typedData | 'EIP712Domain' = keyof typedData,
  >(
    parameters: PrivySignTypedDataRequest<typedData, primaryType>,
  ) => Promise<Hex>;
  signTransaction: <
    serializer extends
      SerializeTransactionFn<TransactionSerializable> = SerializeTransactionFn<TransactionSerializable>,
    transaction extends Parameters<serializer>[0] = Parameters<serializer>[0],
  >(
    transaction: transaction,
    options?: {
      serializer?: serializer;
    },
  ) => Promise<Hex>;
}

export interface CreatePrivyAccountOptions {
  client: PrivyClient;
  chainId?: number;
}

export async function createPrivyAccount(
  options: CreatePrivyAccountOptions,
): Promise<PrivyAccount> {
  const wallet = await options.client.getWallet();

  if (typeof wallet.address !== 'string' || !isAddress(wallet.address)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Privy get wallet request failed: wallet address is missing or invalid',
    );
  }

  const address = wallet.address as Address;
  const defaultChainId = options.chainId ?? DEFAULT_CHAIN_ID;

  return {
    address,
    type: 'json-rpc',
    async sendTransaction(request) {
      const chainId = normalizeChainId(request.chainId ?? defaultChainId);
      const rpcRequest = createSendTransactionRpcRequest(address, chainId, request);
      const response = await options.client.createRpcIntent(rpcRequest);

      return parsePrivyTransactionHash(response);
    },
    async signMessage({ message }) {
      const rpcRequest = createPersonalSignRpcRequest(message);
      const response = await options.client.createRpcIntent(rpcRequest);

      return parsePrivySignature(response, 'personal_sign');
    },
    async signTypedData(parameters) {
      const rpcRequest = createSignTypedDataRpcRequest(parameters);
      const response = await options.client.createRpcIntent(rpcRequest);

      return parsePrivySignature(response, 'eth_signTypedData_v4');
    },
    async signTransaction(transaction) {
      const request = transaction as unknown as PrivySignTransactionRequest;
      const chainId = normalizeChainId(request.chainId ?? defaultChainId);
      const rpcRequest = createSignTransactionRpcRequest(address, chainId, request);
      const response = await options.client.createRpcIntent(rpcRequest);

      return parsePrivySignedTransaction(response);
    },
  };
}

function createSendTransactionRpcRequest(
  from: Address,
  chainId: number,
  request: PrivySendTransactionRequest,
): PrivyRpcIntentRequest {
  const transaction = createPrivyTransactionPayload(from, chainId, request, 'eth_sendTransaction');

  return {
    method: 'eth_sendTransaction',
    caip2: `eip155:${chainId}`,
    params: {
      transaction,
    },
  };
}

function createSignTransactionRpcRequest(
  from: Address,
  chainId: number,
  request: PrivySignTransactionRequest,
): PrivyRpcIntentRequest {
  const transaction = createPrivyTransactionPayload(from, chainId, request, 'eth_signTransaction');

  return {
    method: 'eth_signTransaction',
    params: {
      transaction,
    },
  };
}

function createPersonalSignRpcRequest(message: SignableMessage): PrivyRpcIntentRequest {
  if (typeof message === 'string') {
    return {
      method: 'personal_sign',
      params: {
        message,
        encoding: 'utf-8',
      },
    };
  }

  const raw = message.raw;
  const encodedMessage = raw instanceof Uint8Array ? toHex(raw) : raw;

  if (!isHexString(encodedMessage)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy personal_sign payload: message.raw must be a hex string or Uint8Array',
    );
  }

  return {
    method: 'personal_sign',
    params: {
      message: encodedMessage,
      encoding: 'hex',
    },
  };
}

function createSignTypedDataRpcRequest<
  const typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
>(parameters: PrivySignTypedDataRequest<typedData, primaryType>): PrivyRpcIntentRequest {
  const primaryType = parameters.primaryType;

  if (typeof primaryType !== 'string' || primaryType.trim().length === 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy eth_signTypedData_v4 payload: primaryType is required',
    );
  }

  return {
    method: 'eth_signTypedData_v4',
    params: {
      typed_data: {
        domain: normalizeJsonValue(parameters.domain ?? {}),
        types: normalizeJsonValue(parameters.types),
        message: normalizeJsonValue(parameters.message),
        primary_type: primaryType,
      },
    },
  };
}

function createPrivyTransactionPayload(
  from: Address,
  chainId: number,
  request: PrivySendTransactionRequest,
  rpcMethod: 'eth_sendTransaction' | 'eth_signTransaction',
): Record<string, unknown> {
  if (request.from !== undefined && request.from.toLowerCase() !== from.toLowerCase()) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Failed to build Privy ${rpcMethod} payload: from does not match wallet address`,
    );
  }

  const transaction: Record<string, unknown> = {
    from,
    chain_id: chainId,
  };

  if (request.to !== undefined) {
    transaction.to = request.to;
  }

  if (request.data !== undefined) {
    transaction.data = request.data;
  }

  if (request.value !== undefined) {
    transaction.value = normalizeNumberish(request.value, rpcMethod, 'value');
  }

  if (request.nonce !== undefined) {
    transaction.nonce = normalizeNumberish(request.nonce, rpcMethod, 'nonce');
  }

  if (request.gas !== undefined) {
    transaction.gas_limit = normalizeNumberish(request.gas, rpcMethod, 'gas');
  }

  if (request.gasPrice !== undefined) {
    transaction.gas_price = normalizeNumberish(request.gasPrice, rpcMethod, 'gasPrice');
  }

  if (request.maxFeePerGas !== undefined) {
    transaction.max_fee_per_gas = normalizeNumberish(
      request.maxFeePerGas,
      rpcMethod,
      'maxFeePerGas',
    );
  }

  if (request.maxPriorityFeePerGas !== undefined) {
    transaction.max_priority_fee_per_gas = normalizeNumberish(
      request.maxPriorityFeePerGas,
      rpcMethod,
      'maxPriorityFeePerGas',
    );
  }

  if (request.type !== undefined) {
    transaction.type = request.type;
  }

  return transaction;
}

function parsePrivyTransactionHash(response: PrivyRpcIntentResponse): Hash {
  assertIntentExecuted(response, 'eth_sendTransaction');

  const hash = extractDataString(response, 'hash');
  if (hash === undefined || !HASH_REGEX.test(hash)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy rpc intent ${response.intent_id} executed without a valid transaction hash`,
    );
  }

  return hash as Hash;
}

function parsePrivySignature(
  response: PrivyRpcIntentResponse,
  method: 'personal_sign' | 'eth_signTypedData_v4',
): Hex {
  assertIntentExecuted(response, method);

  const signature = extractDataString(response, 'signature');
  if (signature === undefined || !isHexString(signature)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy rpc intent ${response.intent_id} executed without a valid signature`,
    );
  }

  return signature;
}

function parsePrivySignedTransaction(response: PrivyRpcIntentResponse): Hex {
  assertIntentExecuted(response, 'eth_signTransaction');

  const signedTransaction = extractDataString(response, 'signed_transaction');
  if (signedTransaction === undefined || !isHexString(signedTransaction)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy rpc intent ${response.intent_id} executed without a valid signed transaction`,
    );
  }

  return signedTransaction;
}

function assertIntentExecuted(
  response: PrivyRpcIntentResponse,
  rpcMethod:
    | 'eth_sendTransaction'
    | 'eth_signTransaction'
    | 'personal_sign'
    | 'eth_signTypedData_v4',
): void {
  const intentId = response.intent_id;

  if (response.status === 'executed') {
    return;
  }

  const reason = extractIntentReason(response) ?? 'no reason provided';

  if (response.status === 'failed') {
    if (rpcMethod === 'eth_sendTransaction') {
      throw new TxError('TX_REVERTED', `Privy rpc intent ${intentId} failed: ${reason}`);
    }

    throw new TxError('PRIVY_TRANSPORT_FAILED', `Privy rpc intent ${intentId} failed: ${reason}`);
  }

  if (
    response.status === 'rejected' ||
    response.status === 'dismissed' ||
    response.status === 'expired'
  ) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      `Privy rpc intent ${intentId} ${response.status}: ${reason}`,
    );
  }

  throw new TxError(
    'PRIVY_TRANSPORT_FAILED',
    `Privy rpc intent ${intentId} did not execute (status: ${response.status})`,
  );
}

function extractDataString(response: PrivyRpcIntentResponse, key: string): string | undefined {
  if (!isRecord(response.action_result)) {
    return undefined;
  }

  const responseBody = response.action_result.response_body;
  if (!isRecord(responseBody)) {
    return undefined;
  }

  const data = responseBody.data;
  if (!isRecord(data)) {
    return undefined;
  }

  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

function extractIntentReason(response: PrivyRpcIntentResponse): string | undefined {
  if (typeof response.dismissal_reason === 'string' && response.dismissal_reason.length > 0) {
    return response.dismissal_reason;
  }

  if (isRecord(response.action_result)) {
    const responseBody = response.action_result.response_body;
    if (isRecord(responseBody)) {
      const error = responseBody.error;
      if (typeof error === 'string' && error.length > 0) {
        return error;
      }

      if (isRecord(error)) {
        const errorMessage = error.message;
        if (typeof errorMessage === 'string' && errorMessage.length > 0) {
          return errorMessage;
        }
      }

      const message = responseBody.message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
  }

  return undefined;
}

function normalizeChainId(chainId: PrivyNumberish): number {
  if (typeof chainId === 'number') {
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        'Failed to build Privy chain payload: chainId must be a positive integer',
      );
    }

    return chainId;
  }

  if (typeof chainId === 'bigint') {
    if (chainId <= 0n || chainId > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        'Failed to build Privy chain payload: chainId must be a positive safe integer',
      );
    }

    return Number(chainId);
  }

  const trimmed = chainId.trim();
  if (trimmed.length === 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy chain payload: chainId is empty',
    );
  }

  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed.slice(2), 16);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        'Failed to build Privy chain payload: chainId must be a positive safe integer',
      );
    }

    return parsed;
  }

  if (!/^[0-9]+$/.test(trimmed)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy chain payload: chainId must be a positive safe integer',
    );
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy chain payload: chainId must be a positive safe integer',
    );
  }

  return parsed;
}

function normalizeNumberish(
  value: PrivyNumberish,
  rpcMethod: 'eth_sendTransaction' | 'eth_signTransaction',
  fieldName: string,
): string | number {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        `Failed to build Privy ${rpcMethod} payload: ${fieldName} cannot be negative`,
      );
    }

    return value.toString(10);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        `Failed to build Privy ${rpcMethod} payload: ${fieldName} must be a non-negative number`,
      );
    }

    return Number.isInteger(value) ? value : value.toString();
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Failed to build Privy ${rpcMethod} payload: ${fieldName} is empty`,
    );
  }

  return trimmed;
}

function normalizeJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString(10);
  }

  if (value instanceof Uint8Array) {
    return toHex(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        continue;
      }

      normalized[key] = normalizeJsonValue(entry);
    }

    return normalized;
  }

  throw new TxError(
    'PRIVY_TRANSPORT_FAILED',
    'Failed to build Privy typed data payload: unsupported value type',
  );
}

function isHexString(value: string): value is Hex {
  return HEX_REGEX.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
