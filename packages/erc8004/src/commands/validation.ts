import { Cli, z } from 'incur';
import { checksumAddress, formatTimestamp } from '@spectra-the-bot/cli-shared';
import { readContract, writeContract } from 'viem/actions';
import { validationRegistryAbi, ValidationStatus } from '../contracts/abis.js';
import {
  getPublicClient,
  getWalletClient,
  getValidationRegistryAddress,
  abstractMainnet,
} from '../contracts/client.js';

const validation = Cli.create('validation', {
  description: 'Manage ERC-8004 agent validation requests.',
});

validation.command('request', {
  description: 'Submit a validation request for an agent.',
  hint: 'Requires PRIVATE_KEY environment variable. jobHash must be a 0x-prefixed 32-byte hex string.',
  args: z.object({
    agentId: z.string().describe('Agent token ID to validate'),
  }),
  options: z.object({
    validator: z.string().describe('Validator address'),
    jobHash: z.string().describe('Job hash (bytes32 hex, 0x-prefixed)'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    VALIDATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Validation registry contract address'),
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
        jobHash: '0x' + '00'.repeat(32),
      },
      description: 'Request validation for agent #1',
    },
  ],
  async run(c) {
    const privateKey = c.env['PRIVATE_KEY'];
    if (!privateKey) {
      return c.error({
        code: 'NO_PRIVATE_KEY',
        message: 'PRIVATE_KEY environment variable is required for write operations.',
        retryable: false,
      });
    }

    const walletClient = getWalletClient(privateKey, c.env['ABSTRACT_RPC_URL']);
    const publicClient = getPublicClient(c.env['ABSTRACT_RPC_URL']);
    const address = getValidationRegistryAddress(c.env);

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
        BigInt(c.args.agentId),
        c.options.validator as `0x${string}`,
        jobHash as `0x${string}` & { length: 66 },
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract requestId from the ValidationRequested event
    const eventLog = receipt.logs[0];
    const requestId = eventLog?.topics[1]
      ? BigInt(eventLog.topics[1]).toString()
      : 'unknown';

    return c.ok(
      {
        requestId,
        agentId: c.args.agentId,
        validator: checksumAddress(c.options.validator),
        txHash: hash,
      },
      {
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
  args: z.object({
    requestId: z.string().describe('Validation request ID'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    VALIDATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Validation registry contract address'),
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
    const client = getPublicClient(c.env['ABSTRACT_RPC_URL']);
    const address = getValidationRegistryAddress(c.env);

    const result = await readContract(client, {
      address,
      abi: validationRegistryAbi,
      functionName: 'getValidationStatus',
      args: [BigInt(c.args.requestId)],
    });

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
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    VALIDATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Validation registry contract address'),
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
  examples: [
    { args: { agentId: '1' }, description: 'View validation history for agent #1' },
  ],
  async run(c) {
    const client = getPublicClient(c.env['ABSTRACT_RPC_URL']);
    const address = getValidationRegistryAddress(c.env);
    const tokenId = BigInt(c.args.agentId);

    const count = await readContract(client, {
      address,
      abi: validationRegistryAbi,
      functionName: 'getValidationCount',
      args: [tokenId],
    });

    const totalNum = Number(count);
    const requests: {
      requestId: string;
      validator: string;
      status: string;
      timestamp: string;
    }[] = [];

    for (let i = 0; i < totalNum; i++) {
      const requestId = await readContract(client, {
        address,
        abi: validationRegistryAbi,
        functionName: 'getValidationRequestAt',
        args: [tokenId, BigInt(i)],
      });

      const statusResult = await readContract(client, {
        address,
        abi: validationRegistryAbi,
        functionName: 'getValidationStatus',
        args: [requestId],
      });

      const statusCode = statusResult[3] as keyof typeof ValidationStatus;

      requests.push({
        requestId: requestId.toString(),
        validator: checksumAddress(statusResult[1]),
        status: ValidationStatus[statusCode] ?? 'Unknown',
        timestamp: formatTimestamp(Number(statusResult[5])),
      });
    }

    return c.ok({ agentId: c.args.agentId, requests, total: totalNum });
  },
});

export { validation };
