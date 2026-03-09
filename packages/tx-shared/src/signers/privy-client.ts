import { TxError } from '../errors.js';
import {
  createPrivyAuthorizationPayload,
  generatePrivyAuthorizationSignature,
  normalizePrivyApiUrl,
} from './privy-signature.js';

export interface PrivyRpcIntentRequest {
  method: string;
  params: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PrivyRpcIntentResponse {
  intent_id: string;
  status: string;
  resource_id?: string;
  request_details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PrivyWalletResponse {
  id: string;
  address: string;
  owner_id: string | null;
  policy_ids: string[];
  [key: string]: unknown;
}

export interface PrivyPolicyResponse {
  id: string;
  owner_id: string | null;
  rules: unknown[];
  [key: string]: unknown;
}

export interface CreatePrivyClientOptions {
  appId: string;
  walletId: string;
  authorizationKey: string;
  apiUrl?: string;
  fetchImplementation?: typeof fetch;
}

export interface PrivyRequestOptions {
  idempotencyKey?: string;
}

export interface PrivyClient {
  readonly appId: string;
  readonly walletId: string;
  readonly apiUrl: string;
  createRpcIntent(
    request: PrivyRpcIntentRequest,
    options?: PrivyRequestOptions,
  ): Promise<PrivyRpcIntentResponse>;
  getWallet(): Promise<PrivyWalletResponse>;
  getPolicy(policyId: string): Promise<PrivyPolicyResponse>;
}

export function createPrivyClient(options: CreatePrivyClientOptions): PrivyClient {
  const appId = options.appId.trim();
  const walletId = options.walletId.trim();

  if (appId.length === 0) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_APP_ID format: expected non-empty string',
    );
  }

  if (walletId.length === 0) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_WALLET_ID format: expected non-empty string',
    );
  }

  const apiUrl = normalizePrivyApiUrl(options.apiUrl);
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return {
    appId,
    walletId,
    apiUrl,
    async createRpcIntent(request, requestOptions) {
      const url = `${apiUrl}/v1/intents/wallets/${walletId}/rpc`;
      const payload = createPrivyAuthorizationPayload({
        appId,
        method: 'POST',
        url,
        body: request,
        ...(requestOptions?.idempotencyKey !== undefined
          ? { idempotencyKey: requestOptions.idempotencyKey }
          : {}),
      });

      const signature = generatePrivyAuthorizationSignature(payload, options.authorizationKey);

      return sendPrivyRequest<PrivyRpcIntentResponse>({
        fetchImplementation,
        method: 'POST',
        url,
        body: request,
        operation: 'create rpc intent',
        headers: {
          'privy-app-id': appId,
          'privy-authorization-signature': signature,
          ...(requestOptions?.idempotencyKey !== undefined
            ? { 'privy-idempotency-key': requestOptions.idempotencyKey }
            : {}),
        },
      });
    },
    async getWallet() {
      const url = `${apiUrl}/v1/wallets/${walletId}`;

      return sendPrivyRequest<PrivyWalletResponse>({
        fetchImplementation,
        method: 'GET',
        url,
        operation: 'get wallet',
        headers: {
          'privy-app-id': appId,
        },
      });
    },
    async getPolicy(policyId) {
      if (policyId.trim().length === 0) {
        throw new TxError(
          'PRIVY_TRANSPORT_FAILED',
          'Failed to build Privy policy lookup request: policy id is empty',
        );
      }

      const url = `${apiUrl}/v1/policies/${policyId}`;
      return sendPrivyRequest<PrivyPolicyResponse>({
        fetchImplementation,
        method: 'GET',
        url,
        operation: 'get policy',
        headers: {
          'privy-app-id': appId,
        },
      });
    },
  };
}

interface SendPrivyRequestOptions {
  fetchImplementation: typeof fetch;
  method: 'GET' | 'POST';
  url: string;
  operation: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

async function sendPrivyRequest<TResponse>(options: SendPrivyRequestOptions): Promise<TResponse> {
  let response: Response;
  try {
    response = await options.fetchImplementation(options.url, {
      method: options.method,
      headers: {
        ...options.headers,
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (cause) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy ${options.operation} request failed: network error`,
      cause,
    );
  }

  const payload = await parseJsonResponse(response, options.operation);

  if (!response.ok) {
    const message = extractPrivyErrorMessage(payload) ?? `HTTP ${response.status}`;

    if (response.status === 401 || response.status === 403) {
      throw new TxError(
        'PRIVY_AUTH_FAILED',
        `Privy authentication failed (${response.status}): ${message}`,
      );
    }

    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy ${options.operation} request failed (${response.status}): ${message}`,
    );
  }

  if (!isRecord(payload)) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy ${options.operation} request failed: invalid JSON response shape`,
    );
  }

  return payload as TResponse;
}

async function parseJsonResponse(response: Response, operation: string): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      `Privy ${operation} request failed: invalid JSON response`,
      cause,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractPrivyErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const directMessage = payload.message;
  if (typeof directMessage === 'string' && directMessage.length > 0) {
    return directMessage;
  }

  const errorValue = payload.error;
  if (typeof errorValue === 'string' && errorValue.length > 0) {
    return errorValue;
  }

  if (isRecord(errorValue)) {
    const nestedMessage = errorValue.message;
    if (typeof nestedMessage === 'string' && nestedMessage.length > 0) {
      return nestedMessage;
    }
  }

  return undefined;
}
