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

## Signer Providers

`resolveSigner()` uses deterministic precedence:

1. `privateKey`
2. `keystorePath` (+ `keystorePassword`)
3. `privy` / `PRIVY_*`

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

```bash
export PRIVY_APP_ID="..."
export PRIVY_WALLET_ID="..."
export PRIVY_AUTHORIZATION_KEY="..."
```

> Privy signer resolution now performs wallet address lookup and exposes a Privy-backed account helper for `eth_sendTransaction` intents. Additional signing methods (for example `personal_sign` and typed-data) are tracked in [issue #117](https://github.com/spectra-the-bot/spectra-tools/issues/117).

## `resolveSigner()` usage

### Direct options

```ts
import { resolveSigner } from '@spectratools/tx-shared';

const signer = await resolveSigner({
  privateKey: process.env.PRIVATE_KEY,
});

console.log(signer.provider); // 'private-key' | 'keystore' | 'privy'
console.log(signer.address);  // 0x...
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
  'private-key': process.env.PRIVATE_KEY,
  privy: false,
});

const env = signerEnvSchema.parse(process.env);
const signer = await resolveSigner(toSignerOptions(flags, env));
```

## `executeTx()` lifecycle

`executeTx()` performs this flow:

1. estimate gas (`estimateContractGas`)
2. simulate (`simulateContract`)
3. submit (`writeContract`) unless `dryRun: true`
4. wait for receipt (`waitForTransactionReceipt`)
5. normalize result into a shared output shape

### Live transaction example

```ts
import { executeTx } from '@spectratools/tx-shared';

const result = await executeTx({
  publicClient,
  walletClient,
  account: signer.account,
  address,
  abi,
  functionName: 'register',
  value: registrationFee,
});

console.log(result.hash, result.status, result.gasUsed.toString());
```

### Dry-run example

```ts
const result = await executeTx({
  publicClient,
  walletClient,
  account: signer.account,
  address,
  abi,
  functionName: 'register',
  value: registrationFee,
  dryRun: true,
});

if (result.status === 'dry-run') {
  console.log('estimatedGas', result.estimatedGas.toString());
  console.log('simulationResult', result.simulationResult);
}
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
  - verify all `PRIVY_*` variables are set
  - check signer/owner policy constraints for the Privy wallet
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
