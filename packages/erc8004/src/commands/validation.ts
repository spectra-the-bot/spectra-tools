import { checksumAddress, formatTimestamp } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { readContract, writeContract } from 'viem/actions';
import { ValidationStatus, validationRegistryAbi } from '../contracts/abis.js';
import {
  MULTICALL_BATCH_SIZE,
  abstractMainnet,
  getPublicClient,
  getValidationRegistryAddress,
  getWalletClient,
} from '../contracts/client.js';
import { validateBigIntArg } from '../utils/validate-agent-id.js';
import { mapContractRevertError } from '../utils/viem-errors.js';

const validation = Cli.create('validation', {
  description:
    'Manage ERC-8004 agent validation requests. Defaults to the Abstract mainnet validation registry deployment.',
});

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

validation.command('request', {
  description: 'Submit a validation request for an agent.',
  hint: 'Requires PRIVATE_KEY environment variable. jobHash must be a 0x-prefixed 32-byte hex string. Defaults to the Abstract mainnet validation registry; override via --registry or VALIDATION_REGISTRY_ADDRESS.',
  args: z.object({
    agentId: z.string().describe('Agent token ID to validate'),
  }),
  options: z.object({
    validator: z.string().describe('Validator address'),
    jobHash: z.string().describe('Job hash (bytes32 hex, 0x-prefixed)'),
    registry: z.string().optional().describe('Validation registry contract address override'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    VALIDATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Validation registry contract address override (defaults on Abstract mainnet)'),
    PRIVATE_KEY: z.string().optional().describe('Private key for signing'),
  }),
  output: z.object({
    requestId: z.string(),
    agentId: z.string(),
    validator: z.string(),
    txHash: z.string(),
  }),
  examples: [
    {
      args: { agentId: '1' },
      options: {
        validator: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        jobHash: `0x${'00'.repeat(32)}`,
      },
      description: 'Request validation for agent #1',
    },
  ],
  async run(c) {
    const privateKey = c.env.PRIVATE_KEY;
    if (!privateKey) {
      return c.error({
        code: 'NO_PRIVATE_KEY',
        message: 'PRIVATE_KEY environment variable is required for write operations.',
        retryable: false,
      });
    }

    const walletClient = getWalletClient(privateKey, c.env.ABSTRACT_RPC_URL);
    const publicClient = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getValidationRegistryAddress(c.env, c.options.registry);
    const tokenId = validateBigIntArg(c.args.agentId, 'agentId');

    const jobHash = c.options.jobHash as `0x${string}`;
    if (jobHash.length !== 66) {
      return c.error({
        code: 'INVALID_JOB_HASH',
        message: 'jobHash must be a 0x-prefixed 32-byte hex string (66 chars total)',
        retryable: false,
      });
    }

    const hash = await writeContract(walletClient, {
      chain: abstractMainnet,
      address,
      abi: validationRegistryAbi,
      functionName: 'requestValidation',
      args: [
        tokenId,
        c.options.validator as `0x${string}`,
        jobHash as `0x${string}` & { length: 66 },
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract requestId from the ValidationRequested event
    const eventLog = receipt.logs[0];
    const requestId = eventLog?.topics[1] ? BigInt(eventLog.topics[1]).toString() : 'unknown';

    return c.ok(
      {
        requestId,
        agentId: c.args.agentId,
        validator: checksumAddress(c.options.validator),
        txHash: hash,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Suggested commands:',
              commands: [
                {
                  command: 'validation status' as const,
                  args: { requestId },
                  description: 'Check validation status',
                },
              ],
            },
          },
    );
  },
});

validation.command('status', {
  description: 'Get the status of a validation request.',
  hint: 'Defaults to the Abstract mainnet validation registry. Override via --registry or VALIDATION_REGISTRY_ADDRESS.',
  args: z.object({
    requestId: z.string().describe('Validation request ID'),
  }),
  options: z.object({
    registry: z.string().optional().describe('Validation registry contract address override'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    VALIDATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Validation registry contract address override (defaults on Abstract mainnet)'),
  }),
  output: z.object({
    requestId: z.string(),
    agentId: z.string(),
    validator: z.string(),
    jobHash: z.string(),
    status: z.string(),
    result: z.string(),
    timestamp: z.string(),
  }),
  examples: [{ args: { requestId: '1' }, description: 'Get status of request #1' }],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getValidationRegistryAddress(c.env, c.options.registry);
    const reqId = validateBigIntArg(c.args.requestId, 'requestId');

    let result: readonly [bigint, `0x${string}`, string, number, string, bigint];
    try {
      result = await readContract(client, {
        address,
        abi: validationRegistryAbi,
        functionName: 'getValidationStatus',
        args: [reqId],
      });
    } catch (error) {
      return mapContractRevertError(c, error, 'getValidationStatus');
    }

    const statusCode = result[3] as keyof typeof ValidationStatus;
    const statusLabel = ValidationStatus[statusCode] ?? 'Unknown';

    return c.ok({
      requestId: c.args.requestId,
      agentId: result[0].toString(),
      validator: checksumAddress(result[1]),
      jobHash: result[2],
      status: statusLabel,
      result: result[4],
      timestamp: formatTimestamp(Number(result[5])),
    });
  },
});

validation.command('history', {
  description: 'View validation request history for an agent.',
  hint: 'Defaults to the Abstract mainnet validation registry. Override via --registry or VALIDATION_REGISTRY_ADDRESS.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  options: z.object({
    registry: z.string().optional().describe('Validation registry contract address override'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    VALIDATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Validation registry contract address override (defaults on Abstract mainnet)'),
  }),
  output: z.object({
    agentId: z.string(),
    requests: z.array(
      z.object({
        requestId: z.string(),
        validator: z.string(),
        status: z.string(),
        timestamp: z.string(),
      }),
    ),
    total: z.number(),
  }),
  examples: [{ args: { agentId: '1' }, description: 'View validation history for agent #1' }],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getValidationRegistryAddress(c.env, c.options.registry);
    const tokenId = validateBigIntArg(c.args.agentId, 'agentId');

    let count: bigint;
    try {
      count = await readContract(client, {
        address,
        abi: validationRegistryAbi,
        functionName: 'getValidationCount',
        args: [tokenId],
      });
    } catch (error) {
      return mapContractRevertError(c, error, 'getValidationCount');
    }

    const totalNum = Number(count);
    const requests: {
      requestId: string;
      validator: string;
      status: string;
      timestamp: string;
    }[] = [];

    const indexBatches = chunk(
      Array.from({ length: totalNum }, (_, i) => BigInt(i)),
      MULTICALL_BATCH_SIZE,
    );

    const requestIds: bigint[] = [];
    for (const indexBatch of indexBatches) {
      const requestIdResults = await client.multicall({
        allowFailure: true,
        contracts: indexBatch.map((index) => ({
          address,
          abi: validationRegistryAbi,
          functionName: 'getValidationRequestAt',
          args: [tokenId, index] as const,
        })),
      });

      for (const requestIdResult of requestIdResults) {
        if (requestIdResult.status === 'success') {
          requestIds.push(requestIdResult.result as bigint);
        }
      }
    }

    const requestIdBatches = chunk(requestIds, MULTICALL_BATCH_SIZE);
    for (const requestIdBatch of requestIdBatches) {
      const statusResults = await client.multicall({
        allowFailure: true,
        contracts: requestIdBatch.map((requestId) => ({
          address,
          abi: validationRegistryAbi,
          functionName: 'getValidationStatus',
          args: [requestId] as const,
        })),
      });

      for (let i = 0; i < requestIdBatch.length; i++) {
        const statusResult = statusResults[i];
        if (!statusResult || statusResult.status !== 'success') {
          continue;
        }

        const statusData = statusResult.result;
        const statusCode = statusData[3] as keyof typeof ValidationStatus;

        requests.push({
          requestId: requestIdBatch[i].toString(),
          validator: checksumAddress(statusData[1]),
          status: ValidationStatus[statusCode] ?? 'Unknown',
          timestamp: formatTimestamp(Number(statusData[5])),
        });
      }
    }

    return c.ok({ agentId: c.args.agentId, requests, total: totalNum });
  },
});

export { validation };
