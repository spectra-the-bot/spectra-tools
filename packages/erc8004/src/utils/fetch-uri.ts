const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io';

function parseDataUri(uri: string): unknown {
  const commaIdx = uri.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Invalid data URI');
  }

  const metadata = uri.slice(0, commaIdx);
  const payload = uri.slice(commaIdx + 1);
  const isBase64 = metadata.toLowerCase().includes(';base64');
  const text = isBase64 ? atob(payload) : decodeURIComponent(payload);

  return JSON.parse(text) as unknown;
}

function resolveIpfsUri(uri: string): string {
  if (!uri.startsWith('ipfs://')) {
    return uri;
  }

  const gateway = (process.env.IPFS_GATEWAY?.trim() || DEFAULT_IPFS_GATEWAY).replace(/\/+$/, '');
  const path = uri.slice('ipfs://'.length).replace(/^\/+/, '');

  return `${gateway}/ipfs/${path}`;
}

/** Fetch and parse JSON from a data:, ipfs://, or HTTP(S) URI. */
export async function fetchRegistrationUri(uri: string): Promise<unknown> {
  if (uri.startsWith('data:')) {
    return parseDataUri(uri);
  }

  const httpUrl = resolveIpfsUri(uri);
  const response = await fetch(httpUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch URI: ${httpUrl} returned ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as unknown;
}
