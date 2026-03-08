import { AsyncLocalStorage } from 'node:async_hooks';
import { Errors } from 'incur';

type ErrorCta = {
  description?: string;
  commands: Array<
    | string
    | {
        command: string;
        description?: string;
      }
  >;
};

type ErrorContext = {
  command: string;
  name: string;
  error: (options: {
    code: string;
    cta?: ErrorCta;
    exitCode?: number;
    message: string;
    retryable?: boolean;
  }) => never;
};

type CliLike = {
  serve: (
    argv?: string[],
    options?: {
      env?: Record<string, string | undefined>;
      exit?: (code: number) => void;
      stdout?: (s: string) => void;
    },
  ) => Promise<void>;
  use: (
    handler: (context: ErrorContext, next: () => Promise<void>) => Promise<void> | void,
  ) => unknown;
};

type ViemLikeError = {
  message: string;
  name?: string;
  shortMessage?: string;
};

type FriendlyError = {
  code: string;
  cta?: ErrorCta;
  message: string;
};

const VIEM_VERSION_PATTERN = /\n*Version:\s*viem@[^\n]+/i;
const VIEM_VERSION_PATTERN_GLOBAL = /\n*Version:\s*viem@[^\n]+/gi;
const debugFlagStore = new AsyncLocalStorage<boolean>();
const VIEM_ERROR_NAMES = new Set([
  'CallExecutionError',
  'ContractFunctionExecutionError',
  'ContractFunctionRevertedError',
  'HttpRequestError',
  'InvalidAddressError',
  'TransactionExecutionError',
]);

function parseDebugFlag(argv: string[]): { argv: string[]; debug: boolean } {
  const cleaned: string[] = [];
  let debug = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--debug') {
      debug = true;
      continue;
    }

    if (token === '--debug=true' || token === '--debug=1') {
      debug = true;
      continue;
    }

    if (token === '--debug=false' || token === '--debug=0') {
      debug = false;
      continue;
    }

    cleaned.push(token);
  }

  return { argv: cleaned, debug };
}

function isViemLikeError(error: unknown): error is ViemLikeError {
  if (!(error instanceof Error)) return false;

  const shortMessage = (error as { shortMessage?: unknown }).shortMessage;

  return (
    VIEM_ERROR_NAMES.has(error.name) ||
    VIEM_VERSION_PATTERN.test(error.message) ||
    (typeof shortMessage === 'string' && error.message.includes('Docs: https://viem.sh'))
  );
}

function sanitizeViemMessage(message: string): string {
  return message.replace(VIEM_VERSION_PATTERN_GLOBAL, '').trim();
}

function toFriendlyViemError(error: ViemLikeError): FriendlyError | undefined {
  const shortMessage =
    typeof error.shortMessage === 'string' && error.shortMessage.trim().length > 0
      ? error.shortMessage.trim()
      : undefined;

  if (error.name === 'InvalidAddressError' || shortMessage?.startsWith('Address "')) {
    return {
      code: 'INVALID_ADDRESS',
      message: `${shortMessage ?? 'Invalid address.'} Use a valid 0x-prefixed 20-byte address. Run with --debug for full error details.`,
    };
  }

  if (
    shortMessage?.toLowerCase().includes('http request failed') ||
    error.message.toLowerCase().includes('http request failed')
  ) {
    return {
      code: 'RPC_CONNECTION_FAILED',
      message:
        'RPC connection failed. Check ABSTRACT_RPC_URL and try again. Run with --debug for full error details.',
    };
  }

  if (shortMessage || VIEM_VERSION_PATTERN.test(error.message)) {
    return {
      code: 'UPSTREAM_ERROR',
      message: `${sanitizeViemMessage(shortMessage ?? error.message)} Run with --debug for full error details.`,
    };
  }

  return undefined;
}

function isMissingRequiredArgValidation(error: Errors.ValidationError): boolean {
  return error.fieldErrors.some((fieldError) => {
    const msg = fieldError.message.toLowerCase();
    return msg.includes('received undefined') || fieldError.received === '';
  });
}

function missingArgPaths(error: Errors.ValidationError): string[] {
  const paths = new Set<string>();

  for (const fieldError of error.fieldErrors) {
    const msg = fieldError.message.toLowerCase();
    if (msg.includes('received undefined') || fieldError.received === '') {
      paths.add(fieldError.path);
    }
  }

  return [...paths];
}

function toFriendlyValidationError(
  ctx: Pick<ErrorContext, 'command' | 'name'>,
  error: Errors.ValidationError,
) {
  const missing = missingArgPaths(error);
  if (missing.length === 0) return undefined;

  const helpCommand = `${ctx.name} ${ctx.command} --help`;
  const argsList = missing.join(', ');

  return {
    code: 'VALIDATION_ERROR',
    cta: {
      description: 'See command usage:',
      commands: [{ command: helpCommand }],
    },
    message:
      missing.length === 1
        ? `Missing required argument: ${argsList}. Run \`${helpCommand}\` for usage.`
        : `Missing required arguments: ${argsList}. Run \`${helpCommand}\` for usage.`,
  } satisfies FriendlyError;
}

function handleError(ctx: ErrorContext, error: unknown) {
  if (debugFlagStore.getStore()) throw error;

  if (error instanceof Errors.ValidationError && isMissingRequiredArgValidation(error)) {
    const friendly = toFriendlyValidationError(ctx, error);
    if (friendly) {
      return ctx.error(friendly);
    }
  }

  if (isViemLikeError(error)) {
    const friendly = toFriendlyViemError(error);
    if (friendly) {
      return ctx.error(friendly);
    }
  }

  throw error;
}

export function applyFriendlyErrorHandling(cli: CliLike) {
  const originalServe = cli.serve.bind(cli);
  cli.serve = (async (argv, options) => {
    const rawArgv = argv ?? process.argv.slice(2);
    const parsed = parseDebugFlag(rawArgv);

    return debugFlagStore.run(parsed.debug, () => originalServe(parsed.argv, options));
  }) as typeof cli.serve;

  cli.use(async (context, next) => {
    try {
      await next();
    } catch (error) {
      return handleError(context, error);
    }
  });
}
