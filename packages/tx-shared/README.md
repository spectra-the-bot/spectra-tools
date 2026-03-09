# @spectratools/tx-shared

Shared transaction primitives for Spectra tools:

- signer resolution (`resolveSigner`)
- transaction lifecycle execution (`executeTx`)
- shared signer CLI/env parsing helpers (`toSignerOptions`)
- structured transaction errors (`TxError`)
- Abstract chain helpers (`abstractMainnet`, `createAbstractClient`)

This package is designed for consuming CLIs (for example `@spectratools/assembly-cli`) so write-capable commands follow the same signer precedence, dry-run behavior, and error handling.

## Install

```bash
pnpm add @spectratools/tx-shared
```

## Signer providers

`resolveSigner()` uses deterministic precedence:

1. `privateKey`
2. `keystorePath` (+ `keystorePassword`)
3. Privy (`privy` flag and/or `PRIVY_*` env)

If no provider is configured, it throws `TxError` with code `SIGNER_NOT_CONFIGURED`.

### Provider setup

#### 1) Private key

```bash
export PRIVATE_KEY="0x<64-hex-chars>"
```

Or pass `privateKey` directly in code.

#### 2) Keystore

```bash
# CLI convention
--keystore /path/to/keystore.json --password "$KEYSTORE_PASSWORD"

# env fallback for password
export KEYSTORE_PASSWORD="..."
```

`resolveSigner()` requires a password when `keystorePath` is provided.

#### 3) Privy

Required env:

```bash
export PRIVY_APP_ID="..."
export PRIVY_WALLET_ID="..."
export PRIVY_AUTHORIZATION_KEY="wallet-auth:<base64-pkcs8-p256-private-key>"
```

Optional env:

```bash
export PRIVY_API_URL="https://api.sandbox.privy.io"
```

Optional CLI flags (from `signerFlagSchema`):

```bash
--privy
--privy-api-url "https://api.sandbox.privy.io"
```

Notes:

- `--privy` is optional when `PRIVY_APP_ID` + `PRIVY_WALLET_ID` + `PRIVY_AUTHORIZATION_KEY` are present; `resolveSigner()` auto-detects Privy config.
- `--privy-api-url` / `PRIVY_API_URL` override the default `https://api.privy.io`.
- Privy account methods are mapped as:
  - `sendTransaction` → `eth_sendTransaction`
  - `signMessage` → `personal_sign`
  - `signTypedData` → `eth_signTypedData_v4`
  - `signTransaction` → `eth_signTransaction` (returns serialized tx hex; broadcast separately if needed)

## `resolveSigner()` usage

### Direct options

```ts
import { resolveSigner } from '@spectratools/tx-shared';

const signer = await resolveSigner({
  privateKey: process.env.PRIVATE_KEY,
});

console.log(signer.provider); // 'private-key' | 'keystore' | 'privy'
console.log(signer.address); // 0x...
```

### From shared CLI flags + env

```ts
import {
  resolveSigner,
  signerEnvSchema,
  signerFlagSchema,
  toSignerOptions,
} from '@spectratools/tx-shared';

const flags = signerFlagSchema.parse({
  privy: true,
  'privy-api-url': process.env.PRIVY_API_URL,
});

const env = signerEnvSchema.parse(process.env);
const signer = await resolveSigner(toSignerOptions(flags, env));
```

## `executeTx()` lifecycle

`executeTx()` performs this flow:

1. estimate gas (`estimateContractGas`)
2. simulate (`simulateContract`)
3. preflight Privy policies (when signer is Privy-backed)
4. submit (`writeContract`) unless `dryRun: true`
5. wait for receipt (`waitForTransactionReceipt`)
6. normalize result into a shared output shape

### Privy transaction flow example (dry-run + live)

```ts
import { http, createPublicClient, createWalletClient, parseAbi } from 'viem';
import {
  abstractMainnet,
  executeTx,
  resolveSigner,
  signerEnvSchema,
  signerFlagSchema,
  toSignerOptions,
} from '@spectratools/tx-shared';

const flags = signerFlagSchema.parse({
  privy: true,
  'privy-api-url': process.env.PRIVY_API_URL,
});
const env = signerEnvSchema.parse(process.env);
const signer = await resolveSigner(toSignerOptions(flags, env));

const publicClient = createPublicClient({
  chain: abstractMainnet,
  transport: http(process.env.ABSTRACT_RPC_URL),
});
const walletClient = createWalletClient({
  account: signer.account,
  chain: abstractMainnet,
  transport: http(process.env.ABSTRACT_RPC_URL),
});

const registryAbi = parseAbi(['function register() payable']);

const dryRun = await executeTx({
  publicClient,
  walletClient,
  account: signer.account,
  address: '0x1111111111111111111111111111111111111111',
  abi: registryAbi,
  functionName: 'register',
  value: 1000000000000000n,
  dryRun: true,
});

if (dryRun.status === 'dry-run') {
  console.log(dryRun.estimatedGas.toString());
  console.log(dryRun.privyPolicy?.status); // 'allowed' | 'blocked'
}

const live = await executeTx({
  publicClient,
  walletClient,
  account: signer.account,
  address: '0x1111111111111111111111111111111111111111',
  abi: registryAbi,
  functionName: 'register',
  value: 1000000000000000n,
});

console.log(live.hash, live.status);
```

### Privy signing flow example

```ts
const signer = await resolveSigner({
  privy: true,
  privyAppId: process.env.PRIVY_APP_ID,
  privyWalletId: process.env.PRIVY_WALLET_ID,
  privyAuthorizationKey: process.env.PRIVY_AUTHORIZATION_KEY,
  privyApiUrl: process.env.PRIVY_API_URL,
});

if (signer.provider !== 'privy') throw new Error('Expected Privy signer');

const messageSig = await signer.account.signMessage({ message: 'hello from tx-shared' });

const typedDataSig = await signer.account.signTypedData({
  domain: { name: 'SpectraTools', version: '1', chainId: 2741 },
  primaryType: 'Ping',
  types: {
    Ping: [{ name: 'message', type: 'string' }],
  },
  message: { message: 'privy typed data' },
});

const signedTxHex = await signer.account.signTransaction({
  to: '0x1111111111111111111111111111111111111111',
  chainId: 2741,
  nonce: 1,
  gas: 21000n,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 1000000000n,
  value: 0n,
  data: '0x',
});

console.log(messageSig, typedDataSig, signedTxHex);
```

## Structured errors

`executeTx()` and signer helpers throw `TxError` with stable `code` values:

- `INSUFFICIENT_FUNDS`
- `NONCE_CONFLICT`
- `GAS_ESTIMATION_FAILED`
- `TX_REVERTED`
- `SIGNER_NOT_CONFIGURED`
- `KEYSTORE_DECRYPT_FAILED`
- `PRIVY_AUTH_FAILED`
- `PRIVY_TRANSPORT_FAILED`
- `PRIVY_POLICY_BLOCKED`

```ts
import { TxError } from '@spectratools/tx-shared';

try {
  // resolveSigner(...) + executeTx(...)
} catch (error) {
  if (error instanceof TxError) {
    switch (error.code) {
      case 'INSUFFICIENT_FUNDS':
      case 'NONCE_CONFLICT':
      case 'GAS_ESTIMATION_FAILED':
      case 'TX_REVERTED':
      case 'SIGNER_NOT_CONFIGURED':
      case 'KEYSTORE_DECRYPT_FAILED':
      case 'PRIVY_AUTH_FAILED':
      case 'PRIVY_TRANSPORT_FAILED':
      case 'PRIVY_POLICY_BLOCKED':
        throw error;
    }
  }

  throw error;
}
```

## Troubleshooting

- **`SIGNER_NOT_CONFIGURED`**
  - check signer input precedence
  - confirm at least one provider is configured
- **`KEYSTORE_DECRYPT_FAILED`**
  - verify file path and password
  - ensure keystore is valid V3 JSON
- **`PRIVY_AUTH_FAILED`**
  - verify required env: `PRIVY_APP_ID`, `PRIVY_WALLET_ID`, `PRIVY_AUTHORIZATION_KEY`
  - validate `PRIVY_AUTHORIZATION_KEY` format: `wallet-auth:<base64-pkcs8-p256-private-key>`
  - verify `PRIVY_API_URL` override points at a valid Privy API host
- **`PRIVY_TRANSPORT_FAILED`**
  - check Privy API availability and credentials
  - inspect upstream intent failure payloads for status + reason
- **`PRIVY_POLICY_BLOCKED`**
  - review active wallet policy allowlists and native value caps
  - use `dryRun: true` and inspect `result.privyPolicy` before broadcasting
- **`GAS_ESTIMATION_FAILED` / `TX_REVERTED`**
  - validate function args and `value`
  - run with `dryRun: true` first
- **`NONCE_CONFLICT`**
  - refresh nonce and retry once with an explicit override if needed

## Consumer integration examples

- tx-shared assembly-style example:
  - [`src/examples/assembly-write.ts`](./src/examples/assembly-write.ts)
- assembly consumer reference wiring:
  - [`../assembly/src/examples/tx-shared-register.ts`](../assembly/src/examples/tx-shared-register.ts)
