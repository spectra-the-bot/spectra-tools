import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface MockResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface MockServer {
  url: string;
  requests: RecordedRequest[];
  addRoute(method: string, path: string, response: MockResponse): void;
  close(): Promise<void>;
}

/**
 * Creates a lightweight HTTP mock server for integration testing.
 * Records all incoming requests and returns configured fixture responses.
 */
export async function createMockServer(): Promise<MockServer> {
  const routes = new Map<string, MockResponse>();
  const requests: RecordedRequest[] = [];

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const recorded: RecordedRequest = {
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
      };
      requests.push(recorded);

      const key = `${recorded.method}:${recorded.url.split('?')[0]}`;
      const mock = routes.get(key) ?? routes.get('*');

      const status = mock?.status ?? 200;
      const responseHeaders = mock?.headers ?? { 'Content-Type': 'application/json' };
      const responseBody = mock?.body !== undefined ? JSON.stringify(mock.body) : '{}';

      res.writeHead(status, responseHeaders);
      res.end(responseBody);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server address');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    addRoute(method: string, path: string, response: MockResponse): void {
      routes.set(`${method.toUpperCase()}:${path}`, response);
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
