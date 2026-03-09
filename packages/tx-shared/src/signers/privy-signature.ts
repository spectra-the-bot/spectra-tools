import { type KeyObject, createPrivateKey, sign as signWithCrypto } from 'node:crypto';
import { TxError } from '../errors.js';

const PRIVY_AUTHORIZATION_KEY_PREFIX = 'wallet-auth:';
const PRIVY_AUTHORIZATION_KEY_REGEX = /^wallet-auth:[A-Za-z0-9+/]+={0,2}$/;
const DEFAULT_PRIVY_API_URL = 'https://api.privy.io';

export type PrivyAuthorizationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PrivyAuthorizationPayloadHeaders {
  'privy-app-id': string;
  'privy-idempotency-key'?: string;
}

export interface PrivyAuthorizationPayload<TBody extends Record<string, unknown>> {
  version: 1;
  method: PrivyAuthorizationMethod;
  url: string;
  headers: PrivyAuthorizationPayloadHeaders;
  body: TBody;
}

export interface CreatePrivyAuthorizationPayloadOptions<TBody extends Record<string, unknown>> {
  appId: string;
  method: PrivyAuthorizationMethod;
  url: string;
  body: TBody;
  idempotencyKey?: string;
}

export function normalizePrivyApiUrl(apiUrl?: string): string {
  const value = (apiUrl ?? DEFAULT_PRIVY_API_URL).trim();

  if (value.length === 0) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_API_URL format: expected a non-empty http(s) URL',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (cause) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_API_URL format: expected a non-empty http(s) URL',
      cause,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_API_URL format: expected a non-empty http(s) URL',
    );
  }

  return parsed.toString().replace(/\/+$/, '');
}

export function parsePrivyAuthorizationKey(authorizationKey: string): KeyObject {
  const normalizedKey = authorizationKey.trim();

  if (!PRIVY_AUTHORIZATION_KEY_REGEX.test(normalizedKey)) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
    );
  }

  const rawPrivateKey = normalizedKey.slice(PRIVY_AUTHORIZATION_KEY_PREFIX.length);

  let derKey: Buffer;
  try {
    derKey = Buffer.from(rawPrivateKey, 'base64');
  } catch (cause) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
      cause,
    );
  }

  let keyObject: KeyObject;
  try {
    keyObject = createPrivateKey({
      key: derKey,
      format: 'der',
      type: 'pkcs8',
    });
  } catch (cause) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
      cause,
    );
  }

  if (keyObject.asymmetricKeyType !== 'ec') {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
    );
  }

  const details = keyObject.asymmetricKeyDetails;
  const namedCurve =
    details !== undefined && 'namedCurve' in details
      ? (details.namedCurve as string | undefined)
      : undefined;

  if (namedCurve !== undefined && namedCurve !== 'prime256v1') {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
    );
  }

  return keyObject;
}

export function createPrivyAuthorizationPayload<TBody extends Record<string, unknown>>(
  options: CreatePrivyAuthorizationPayloadOptions<TBody>,
): PrivyAuthorizationPayload<TBody> {
  const appId = options.appId.trim();

  if (appId.length === 0) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_APP_ID format: expected non-empty string',
    );
  }

  const url = options.url.trim().replace(/\/+$/, '');

  if (url.length === 0) {
    throw new TxError(
      'PRIVY_TRANSPORT_FAILED',
      'Failed to build Privy authorization payload: request URL is empty',
    );
  }

  return {
    version: 1,
    method: options.method,
    url,
    headers: {
      'privy-app-id': appId,
      ...(options.idempotencyKey !== undefined
        ? { 'privy-idempotency-key': options.idempotencyKey }
        : {}),
    },
    body: options.body,
  };
}

export function serializePrivyAuthorizationPayload(
  payload: PrivyAuthorizationPayload<Record<string, unknown>>,
): string {
  return canonicalizeJson(payload);
}

export function generatePrivyAuthorizationSignature(
  payload: PrivyAuthorizationPayload<Record<string, unknown>>,
  authorizationKey: string,
): string {
  const privateKey = parsePrivyAuthorizationKey(authorizationKey);
  const serializedPayload = serializePrivyAuthorizationPayload(payload);

  const signature = signWithCrypto('sha256', Buffer.from(serializedPayload), privateKey);
  return signature.toString('base64');
}

function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TxError(
        'PRIVY_TRANSPORT_FAILED',
        'Failed to build Privy authorization payload: JSON payload contains a non-finite number',
      );
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));

    const entries: string[] = [];
    for (const key of keys) {
      const entryValue = record[key];
      if (entryValue === undefined) {
        continue;
      }

      entries.push(`${JSON.stringify(key)}:${canonicalizeJson(entryValue)}`);
    }

    return `{${entries.join(',')}}`;
  }

  throw new TxError(
    'PRIVY_TRANSPORT_FAILED',
    'Failed to build Privy authorization payload: JSON payload contains unsupported value type',
  );
}
