import { type Account, type Address, type Hash, type Hex, isAddress } from 'viem';
import { TxError } from '../errors.js';
import type { PrivyClient, PrivyRpcIntentRequest, PrivyRpcIntentResponse } from './privy-client.js';

const DEFAULT_CHAIN_ID = 2741;
const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

type PrivyNumberish = bigint | number | string;

export interface PrivySendTransactionRequest {
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

export type PrivyAccount = Extract<Account, { type: 'json-rpc' }> & {
  sendTransaction: (request: PrivySendTransactionRequest) => Promise<Hash>;
};

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
  };
}

function createSendTransactionRpcRequest(
  from: Address,
  chainId: number,
  request: PrivySendTransactionRequest,
): PrivyRpcIntentRequest {
  const transaction: Record<string, unknown> = {
    from,
  };

  if (request.to !== undefined) {
    transaction.to = request.to;
  }

  if (request.data !== undefined) {
    transaction.data = request.data;
  }

  if (request.value !== undefined) {
    transaction.value = normalizeNumberish(request.value, 'value');
  }

  if (request.nonce !== undefined) {
    transaction.nonce = normalizeNumberish(request.nonce, 'nonce');
  }

  if (request.gas !== undefined) {
    transaction.gas_limit = normalizeNumberish(request.gas, 'gas');
  }

  if (request.gasPrice !== undefined) {
    transaction.gas_price = normalizeNumberish(request.gasPrice, 'gasPrice');
  }

  if (request.maxFeePerGas !== undefined) {
    transaction.max_fee_per_gas = normalizeNumberish(request.maxFeePerGas, 'maxFeePerGas');
  }

  if (request.maxPriorityFeePerGas !== undefined) {
    transaction.max_priority_fee_per_gas = normalizeNumberish(
      request.maxPriorityFeePerGas,
      'maxPriorityFeePerGas',
    );
  }

  if (request.type !== undefined) {
    transaction.type = request.type;
  }

  transaction.chain_id = chainId;

  return {
    method: 'eth_sendTransaction',
    caip2: `eip155:${chainId}`,
    params: {
      transaction,
    },
  };
}

function parsePrivyTransactionHash(response: PrivyRpcIntentResponse): Hash {
  const intentId = response.intent_id;

  if (response.status !== 'executed') {
    const reason = extractIntentReason(response) ?? 'no reason provided';

    if (response.status === 'failed') {
      throw new TxError('TX_REVERTED', `Privy rpc intent ${intentId} failed: ${reason}`);
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

  const hash = extractIntentHash(response);
  if (hash === undefined || !HASH_REGEX.test(hash)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy rpc intent ${intentId} executed without a valid transaction hash`,
    );
  }

  return hash as Hash;
}

function extractIntentHash(response: PrivyRpcIntentResponse): string | undefined {
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

  return typeof data.hash === 'string' ? data.hash : undefined;
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
        'Failed to build Privy eth_sendTransaction payload: chainId must be a positive integer',
      );
    }

    return chainId;
  }

  if (typeof chainId === 'bigint') {
    if (chainId <= 0n || chainId > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        'Failed to build Privy eth_sendTransaction payload: chainId must be a positive safe integer',
      );
    }

    return Number(chainId);
  }

  const trimmed = chainId.trim();
  if (trimmed.length === 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy eth_sendTransaction payload: chainId is empty',
    );
  }

  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed.slice(2), 16);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        'Failed to build Privy eth_sendTransaction payload: chainId must be a positive safe integer',
      );
    }

    return parsed;
  }

  if (!/^[0-9]+$/.test(trimmed)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy eth_sendTransaction payload: chainId must be a positive safe integer',
    );
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy eth_sendTransaction payload: chainId must be a positive safe integer',
    );
  }

  return parsed;
}

function normalizeNumberish(value: PrivyNumberish, fieldName: string): string | number {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        `Failed to build Privy eth_sendTransaction payload: ${fieldName} cannot be negative`,
      );
    }

    return value.toString(10);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        `Failed to build Privy eth_sendTransaction payload: ${fieldName} must be a non-negative number`,
      );
    }

    return Number.isInteger(value) ? value : value.toString();
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Failed to build Privy eth_sendTransaction payload: ${fieldName} is empty`,
    );
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
