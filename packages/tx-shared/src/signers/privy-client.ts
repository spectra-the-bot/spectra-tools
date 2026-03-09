import type { Address } from 'viem';
import { isAddress } from 'viem';
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

export type PrivyIntentStatus =
  | 'pending'
  | 'executed'
  | 'failed'
  | 'expired'
  | 'rejected'
  | 'dismissed'
  | string;

export interface PrivyRpcIntentResponse {
  intent_id: string;
  status: PrivyIntentStatus;
  resource_id?: string;
  request_details?: Record<string, unknown>;
  dismissal_reason?: string;
  action_result?: {
    response_body?: Record<string, unknown>;
    [key: string]: unknown;
  };
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

export interface PrivyNormalizedPolicy {
  id: string;
  ownerId: string | null;
  ruleCount: number;
  allowlistedContracts: Address[];
  maxValueWei?: bigint;
}

export interface PrivyPolicyVisibility {
  walletId: string;
  policyIds: string[];
  policies: PrivyNormalizedPolicy[];
  contractAllowlist: Address[];
  maxValueWei?: bigint;
}

export type PrivyPolicyViolationType = 'contract-allowlist' | 'native-value-cap';

export interface PrivyPolicyViolation {
  type: PrivyPolicyViolationType;
  message: string;
  policyIds: string[];
  actual: string;
  expected: string;
}

export interface PrivyPolicyPreflightRequest {
  to?: Address;
  value?: bigint;
}

export interface PrivyPolicyPreflightResult {
  status: 'allowed' | 'blocked';
  visibility: PrivyPolicyVisibility;
  violations: PrivyPolicyViolation[];
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

const ALLOWLIST_KEYS = new Set([
  'allowedcontracts',
  'allowlistedcontracts',
  'contractallowlist',
  'toallowlist',
  'allowedtoaddresses',
]);

const MAX_VALUE_KEYS = new Set([
  'maxvalue',
  'maxvaluewei',
  'maxnativevalue',
  'maxnativevaluewei',
  'maxtransferamount',
  'maxtransferamountwei',
  'valuecap',
  'valuecapwei',
]);

/** Normalize a raw Privy policy object into tx-shared's policy model. */
export function normalizePrivyPolicy(policy: PrivyPolicyResponse): PrivyNormalizedPolicy {
  const constraints = extractConstraintsFromValue(policy.rules);
  const allowlistedContracts = Array.from(constraints.allowlistedContracts)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => value as Address);

  const maxValueWei = selectLowestValue(constraints.maxValueWeiCandidates);

  return {
    id: policy.id,
    ownerId: policy.owner_id,
    ruleCount: Array.isArray(policy.rules) ? policy.rules.length : 0,
    allowlistedContracts,
    ...(maxValueWei !== undefined ? { maxValueWei } : {}),
  };
}

/** Fetch wallet policies and return normalized visibility data for callers. */
export async function fetchPrivyPolicyVisibility(
  client: PrivyClient,
): Promise<PrivyPolicyVisibility> {
  const wallet = await client.getWallet();
  const policyIds = normalizePolicyIds(wallet.policy_ids);

  const policies: PrivyNormalizedPolicy[] = [];
  for (const policyId of policyIds) {
    const policy = await client.getPolicy(policyId);
    policies.push(normalizePrivyPolicy(policy));
  }

  const contractAllowlistSet = new Set<string>();
  const maxValueCandidates: bigint[] = [];

  for (const policy of policies) {
    for (const contractAddress of policy.allowlistedContracts) {
      contractAllowlistSet.add(contractAddress.toLowerCase());
    }

    if (policy.maxValueWei !== undefined) {
      maxValueCandidates.push(policy.maxValueWei);
    }
  }

  const contractAllowlist = Array.from(contractAllowlistSet)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => value as Address);

  const maxValueWei = selectLowestValue(maxValueCandidates);

  return {
    walletId: wallet.id,
    policyIds,
    policies,
    contractAllowlist,
    ...(maxValueWei !== undefined ? { maxValueWei } : {}),
  };
}

/**
 * Evaluate immediately-deterministic Privy constraints (contract allowlists + native value caps).
 */
export async function preflightPrivyTransactionPolicy(
  client: PrivyClient,
  request: PrivyPolicyPreflightRequest,
): Promise<PrivyPolicyPreflightResult> {
  const visibility = await fetchPrivyPolicyVisibility(client);
  const violations: PrivyPolicyViolation[] = [];

  if (request.to !== undefined && visibility.contractAllowlist.length > 0) {
    const toAddress = request.to.toLowerCase();
    const isAllowed = visibility.contractAllowlist.some(
      (allowedContract) => allowedContract.toLowerCase() === toAddress,
    );

    if (!isAllowed) {
      const constrainedPolicyIds = visibility.policies
        .filter((policy) => policy.allowlistedContracts.length > 0)
        .map((policy) => policy.id)
        .sort((left, right) => left.localeCompare(right));

      violations.push({
        type: 'contract-allowlist',
        message: `Target contract ${request.to} is not allowlisted by active Privy policies`,
        policyIds: constrainedPolicyIds,
        actual: request.to,
        expected: visibility.contractAllowlist.join(', '),
      });
    }
  }

  if (request.value !== undefined && visibility.maxValueWei !== undefined) {
    if (request.value > visibility.maxValueWei) {
      const constrainedPolicyIds = visibility.policies
        .filter((policy) => policy.maxValueWei === visibility.maxValueWei)
        .map((policy) => policy.id)
        .sort((left, right) => left.localeCompare(right));

      violations.push({
        type: 'native-value-cap',
        message: `Native value ${request.value.toString()} exceeds Privy policy max ${visibility.maxValueWei.toString()}`,
        policyIds: constrainedPolicyIds,
        actual: request.value.toString(),
        expected: visibility.maxValueWei.toString(),
      });
    }
  }

  return {
    status: violations.length > 0 ? 'blocked' : 'allowed',
    visibility,
    violations,
  };
}

/** Convert blocked preflight output into a deterministic structured TxError. */
export function toPrivyPolicyViolationError(result: PrivyPolicyPreflightResult): TxError {
  const message =
    result.violations.length > 0
      ? result.violations
          .map((violation) => {
            const policies =
              violation.policyIds.length > 0
                ? ` (policies: ${violation.policyIds.join(', ')})`
                : '';
            return `${violation.message}${policies}`;
          })
          .join('; ')
      : 'Privy policy preflight blocked transaction';

  return new TxError(
    'PRIVY_POLICY_BLOCKED',
    `Privy policy preflight blocked transaction: ${message}`,
  );
}

interface SendPrivyRequestOptions {
  fetchImplementation: typeof fetch;
  method: 'GET' | 'POST';
  url: string;
  operation: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

interface ExtractedConstraints {
  allowlistedContracts: Set<string>;
  maxValueWeiCandidates: bigint[];
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

function extractConstraintsFromValue(value: unknown): ExtractedConstraints {
  const constraints: ExtractedConstraints = {
    allowlistedContracts: new Set<string>(),
    maxValueWeiCandidates: [],
  };

  visitConstraintNode(value, constraints);
  return constraints;
}

function visitConstraintNode(value: unknown, constraints: ExtractedConstraints): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visitConstraintNode(item, constraints);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeConstraintKey(key);

    if (ALLOWLIST_KEYS.has(normalizedKey)) {
      for (const address of parseAddressList(entry)) {
        constraints.allowlistedContracts.add(address.toLowerCase());
      }
    }

    if (MAX_VALUE_KEYS.has(normalizedKey)) {
      const parsedValue = parseWeiValue(entry);
      if (parsedValue !== undefined) {
        constraints.maxValueWeiCandidates.push(parsedValue);
      }
    }

    visitConstraintNode(entry, constraints);
  }
}

function normalizeConstraintKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function parseAddressList(value: unknown): Address[] {
  const entries = Array.isArray(value) ? value : [value];
  const addresses: Address[] = [];

  for (const entry of entries) {
    if (typeof entry !== 'string') {
      continue;
    }

    if (!isAddress(entry)) {
      continue;
    }

    addresses.push(entry as Address);
  }

  return addresses;
}

function parseWeiValue(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') {
    return value >= 0n ? value : undefined;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      return undefined;
    }

    return BigInt(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return BigInt(trimmed);
    }

    if (/^[0-9]+$/.test(trimmed)) {
      return BigInt(trimmed);
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function selectLowestValue(values: bigint[]): bigint | undefined {
  if (values.length === 0) {
    return undefined;
  }

  let minimum = values[0];
  for (const value of values.slice(1)) {
    if (value < minimum) {
      minimum = value;
    }
  }

  return minimum;
}

function normalizePolicyIds(policyIds: unknown): string[] {
  if (!Array.isArray(policyIds)) {
    return [];
  }

  const ids = new Set<string>();
  for (const entry of policyIds) {
    if (typeof entry !== 'string') {
      continue;
    }

    const normalized = entry.trim();
    if (normalized.length === 0) {
      continue;
    }

    ids.add(normalized);
  }

  return Array.from(ids).sort((left, right) => left.localeCompare(right));
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
