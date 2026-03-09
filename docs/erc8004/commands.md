# erc8004

## erc8004 discovery

Discover and resolve ERC-8004 agents.

### erc8004 discovery resolve

Resolve a full agent identifier (&lt;registry&gt;:&lt;agentId&gt;) to agent details.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | `string` | yes | Agent identifier in format &lt;registryAddress&gt;:&lt;agentId&gt; |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IPFS_GATEWAY` | `string` | no |  | IPFS gateway override (default: https://ipfs.io) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identifier` | `string` | yes |  |
| `registry` | `string` | yes |  |
| `agentId` | `string` | yes |  |
| `owner` | `string` | yes |  |
| `uri` | `string` | yes |  |
| `name` | `string` | no |  |
| `description` | `string` | no |  |

#### Examples

```sh
# Resolve agent #42 from a specific registry
erc8004 discovery resolve 0xRegistryAddress:42
```

### erc8004 discovery search

Search for registered agents by name or service type.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `IPFS_GATEWAY` | `string` | no |  | IPFS gateway override (default: https://ipfs.io) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name` | `string` |  | Search agents by name (case-insensitive substring) |
| `--service` | `string` |  | Filter by service type (e.g. "mcp", "openapi") |
| `--limit` | `number` | `20` | Maximum number of results |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `results` | `array` | yes |  |
| `results[].agentId` | `string` | yes |  |
| `results[].owner` | `string` | yes |  |
| `results[].name` | `string` | no |  |
| `results[].description` | `string` | no |  |
| `results[].services` | `array` | no |  |
| `results[].uri` | `string` | yes |  |
| `total` | `number` | yes |  |

#### Examples

```sh
# Search for agents named "assistant"
erc8004 discovery search --name assistant

# Find agents with MCP service endpoints
erc8004 discovery search --service mcp

# Combined search
erc8004 discovery search --name coder --service openapi --limit 5
```

## erc8004 identity

Manage ERC-8004 agent identities.

### erc8004 identity burn

Permanently destroy an agent identity token.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID to burn |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--confirm` | `boolean` | `false` | Confirm the irreversible burn operation (required) |
| `--dry-run` | `boolean` | `false` | Simulate the burn without executing |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `status` | `string` | yes |  |
| `message` | `string` | yes |  |

#### Examples

```sh
# Burn agent #1 (not currently supported)
erc8004 identity burn 1 --confirm true
```

> This is a destructive, irreversible operation. The agent identity will be permanently deleted.

### erc8004 identity get

Get details for a specific agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `owner` | `string` | yes |  |
| `uri` | `string` | yes |  |
| `wallet` | `string` | no |  |

#### Examples

```sh
# Get agent #1
erc8004 identity get 1
```

### erc8004 identity list

List registered agents, optionally filtered by owner.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--owner` | `string` |  | Filter by owner address |
| `--limit` | `number` | `50` | Maximum number of results |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agents` | `array` | yes |  |
| `agents[].agentId` | `string` | yes |  |
| `agents[].owner` | `string` | yes |  |
| `agents[].uri` | `string` | yes |  |
| `total` | `number` | yes |  |

#### Examples

```sh
# List first 10 agents
erc8004 identity list --limit 10

# List agents owned by an address
erc8004 identity list --owner 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --limit 20
```

### erc8004 identity metadata

Read agent metadata key(s).

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--key` | `string` |  | Specific metadata key to fetch |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `key` | `string` | no |  |
| `value` | `string` | no |  |

#### Examples

```sh
# Get contact metadata for agent #1
erc8004 identity metadata 1 --key contact
```

### erc8004 identity register

Register a new agent identity.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing (hex with 0x prefix) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--uri` | `string` |  | Registration file URI (IPFS, HTTPS, or data: URI) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `uri` | `string` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Register with IPFS URI
erc8004 identity register --uri ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

> Requires PRIVATE_KEY environment variable for signing.

### erc8004 identity set-metadata

Set a metadata key-value pair on an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--key` | `string` |  | Metadata key to set |
| `--value` | `string` |  | Metadata value to set |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `key` | `string` | yes |  |
| `value` | `string` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Set contact metadata for agent #1
erc8004 identity set-metadata 1 --key contact --value agent@example.com
```

> Requires PRIVATE_KEY environment variable for signing. Caller must be the token owner.

### erc8004 identity set-wallet

Set an agent's associated wallet address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--wallet` | `string` |  | New wallet address |
| `--signature` | `string` |  | Signature from the new wallet authorizing the association |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `wallet` | `string` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Associate a new wallet with agent #1
erc8004 identity set-wallet 1 --wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --signature 0x1234...abcd
```

> Requires PRIVATE_KEY environment variable. The signature must be from the new wallet.

### erc8004 identity transfer

Transfer an agent identity token to a new owner.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID to transfer |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--to` | `string` |  | Recipient address |
| `--safe` | `boolean` | `true` | Use safeTransferFrom (checks recipient can receive ERC-721). Disable with --no-safe. |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `from` | `string` | yes |  |
| `to` | `string` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Transfer agent #1 to a new owner
erc8004 identity transfer 1 --to 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

> Requires PRIVATE_KEY environment variable. Caller must be the token owner or approved.

### erc8004 identity update

Update an agent's registration URI.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--uri` | `string` |  | New registration file URI |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `uri` | `string` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Update agent #1's registration URI
erc8004 identity update 1 --uri ipfs://bafybeihash/new-agent-registration.json
```

> Requires PRIVATE_KEY environment variable for signing.

### erc8004 identity wallet

Get an agent's associated wallet address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `wallet` | `string` | yes |  |

#### Examples

```sh
# Get wallet bound to agent #1
erc8004 identity wallet 1
```

## erc8004 registration

Fetch, validate, and create ERC-8004 registration files.

### erc8004 registration create

Generate a registration JSON file for an agent.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name` | `string` |  | Agent name |
| `--description` | `string` |  | Agent description |
| `--agentVersion` | `string` |  | Agent version (semver) |
| `--homepage` | `string` |  | Agent homepage URL |
| `--capabilities` | `array` |  | Capability tags |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Human-readable agent name |
| `description` | `string` | no | What the agent does |
| `version` | `string` | no | Agent version (semver) |
| `image` | `string` | no | Agent avatar/icon URL |
| `homepage` | `string` | no | Agent homepage or documentation URL |
| `services` | `array` | no | Services the agent exposes |
| `services[].id` | `string` | no | Unique identifier for this service (legacy field) |
| `services[].type` | `string` | no | Service type (e.g. "mcp", "openapi", "webhook") |
| `services[].url` | `string` | no | Service endpoint URL (legacy field) |
| `services[].name` | `string` | no | Service name from the ERC-8004 registration format |
| `services[].endpoint` | `string` | no | Service endpoint from the ERC-8004 registration format |
| `services[].description` | `string` | no | Human-readable description |
| `services[].version` | `string` | no | Service version |
| `services[].x402` | `unknown` | no | Optional x402 payment metadata for this service |
| `services[].auth` | `object` | no | Authentication requirements |
| `services[].auth.type` | `string` | yes | Authentication type |
| `services[].auth.scheme` | `string` | no | Authentication scheme details |
| `capabilities` | `array` | no | High-level capability tags (e.g. "code-review", "data-analysis") |
| `owner` | `object` | no | Agent owner information |
| `owner.name` | `string` | no | Owner name |
| `owner.url` | `string` | no | Owner URL |
| `owner.contact` | `string` | no | Contact email or URL |
| `metadata` | `object` | no | Arbitrary key-value metadata |
| `x402Support` | `boolean` | no | Optional x402 support flag |
| `supportedTrust` | `array` | no | Optional trust mechanisms supported by the agent |
| `erc8004` | `object` | no | ERC-8004 specific fields |
| `erc8004.version` | `string` | yes | ERC-8004 spec version |
| `erc8004.identityRegistry` | `string` | no | Identity registry address |
| `erc8004.agentId` | `string` | no | Agent token ID |

#### Examples

```sh
# Create a basic registration file
erc8004 registration create --name My Agent --description A helpful AI agent --agentVersion 1.0.0 --capabilities code-review,data-analysis
```

### erc8004 registration fetch

Fetch and parse the registration file for an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `IDENTITY_REGISTRY_ADDRESS` | `string` | no |  | Identity registry contract address |
| `IPFS_GATEWAY` | `string` | no |  | IPFS gateway override (default: https://ipfs.io) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `uri` | `string` | yes |  |
| `registration` | `object` | yes |  |
| `registration.name` | `string` | yes | Human-readable agent name |
| `registration.description` | `string` | no | What the agent does |
| `registration.version` | `string` | no | Agent version (semver) |
| `registration.image` | `string` | no | Agent avatar/icon URL |
| `registration.homepage` | `string` | no | Agent homepage or documentation URL |
| `registration.services` | `array` | no | Services the agent exposes |
| `registration.services[].id` | `string` | no | Unique identifier for this service (legacy field) |
| `registration.services[].type` | `string` | no | Service type (e.g. "mcp", "openapi", "webhook") |
| `registration.services[].url` | `string` | no | Service endpoint URL (legacy field) |
| `registration.services[].name` | `string` | no | Service name from the ERC-8004 registration format |
| `registration.services[].endpoint` | `string` | no | Service endpoint from the ERC-8004 registration format |
| `registration.services[].description` | `string` | no | Human-readable description |
| `registration.services[].version` | `string` | no | Service version |
| `registration.services[].x402` | `unknown` | no | Optional x402 payment metadata for this service |
| `registration.services[].auth` | `object` | no | Authentication requirements |
| `registration.services[].auth.type` | `string` | yes | Authentication type |
| `registration.services[].auth.scheme` | `string` | no | Authentication scheme details |
| `registration.capabilities` | `array` | no | High-level capability tags (e.g. "code-review", "data-analysis") |
| `registration.owner` | `object` | no | Agent owner information |
| `registration.owner.name` | `string` | no | Owner name |
| `registration.owner.url` | `string` | no | Owner URL |
| `registration.owner.contact` | `string` | no | Contact email or URL |
| `registration.metadata` | `object` | no | Arbitrary key-value metadata |
| `registration.x402Support` | `boolean` | no | Optional x402 support flag |
| `registration.supportedTrust` | `array` | no | Optional trust mechanisms supported by the agent |
| `registration.erc8004` | `object` | no | ERC-8004 specific fields |
| `registration.erc8004.version` | `string` | yes | ERC-8004 spec version |
| `registration.erc8004.identityRegistry` | `string` | no | Identity registry address |
| `registration.erc8004.agentId` | `string` | no | Agent token ID |
| `valid` | `boolean` | yes |  |

#### Examples

```sh
# Fetch registration for agent #1
erc8004 registration fetch 1
```

### erc8004 registration validate

Validate a registration file at a given URI.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `uri` | `string` | yes | URI to the registration file (HTTPS, IPFS, or data:) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `IPFS_GATEWAY` | `string` | no |  | IPFS gateway override (default: https://ipfs.io) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uri` | `string` | yes |  |
| `valid` | `boolean` | yes |  |
| `errors` | `array` | no |  |
| `registration` | `object` | no |  |
| `registration.name` | `string` | yes | Human-readable agent name |
| `registration.description` | `string` | no | What the agent does |
| `registration.version` | `string` | no | Agent version (semver) |
| `registration.image` | `string` | no | Agent avatar/icon URL |
| `registration.homepage` | `string` | no | Agent homepage or documentation URL |
| `registration.services` | `array` | no | Services the agent exposes |
| `registration.services[].id` | `string` | no | Unique identifier for this service (legacy field) |
| `registration.services[].type` | `string` | no | Service type (e.g. "mcp", "openapi", "webhook") |
| `registration.services[].url` | `string` | no | Service endpoint URL (legacy field) |
| `registration.services[].name` | `string` | no | Service name from the ERC-8004 registration format |
| `registration.services[].endpoint` | `string` | no | Service endpoint from the ERC-8004 registration format |
| `registration.services[].description` | `string` | no | Human-readable description |
| `registration.services[].version` | `string` | no | Service version |
| `registration.services[].x402` | `unknown` | no | Optional x402 payment metadata for this service |
| `registration.services[].auth` | `object` | no | Authentication requirements |
| `registration.services[].auth.type` | `string` | yes | Authentication type |
| `registration.services[].auth.scheme` | `string` | no | Authentication scheme details |
| `registration.capabilities` | `array` | no | High-level capability tags (e.g. "code-review", "data-analysis") |
| `registration.owner` | `object` | no | Agent owner information |
| `registration.owner.name` | `string` | no | Owner name |
| `registration.owner.url` | `string` | no | Owner URL |
| `registration.owner.contact` | `string` | no | Contact email or URL |
| `registration.metadata` | `object` | no | Arbitrary key-value metadata |
| `registration.x402Support` | `boolean` | no | Optional x402 support flag |
| `registration.supportedTrust` | `array` | no | Optional trust mechanisms supported by the agent |
| `registration.erc8004` | `object` | no | ERC-8004 specific fields |
| `registration.erc8004.version` | `string` | yes | ERC-8004 spec version |
| `registration.erc8004.identityRegistry` | `string` | no | Identity registry address |
| `registration.erc8004.agentId` | `string` | no | Agent token ID |

#### Examples

```sh
# Validate an HTTPS registration file
erc8004 registration validate https://example.com/agent.json

# Validate an IPFS registration file
erc8004 registration validate ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

## erc8004 reputation

Manage ERC-8004 agent reputation and feedback. Defaults to the Abstract mainnet reputation registry deployment.

### erc8004 reputation feedback

Submit feedback for an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `REPUTATION_REGISTRY_ADDRESS` | `string` | no |  | Reputation registry contract address override (defaults on Abstract mainnet) |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--value` | `number` |  | Feedback value (int128, positive or negative) |
| `--tag1` | `string` |  | Primary tag (e.g. "accuracy", "speed") |
| `--tag2` | `string` |  | Secondary tag |
| `--fileUri` | `string` |  | URI to a supporting file or report |
| `--registry` | `string` |  | Reputation registry contract address override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `value` | `number` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Submit positive feedback
erc8004 reputation feedback 1 --value 10 --tag1 accuracy --tag2 helpful

# Submit negative feedback
erc8004 reputation feedback 1 --value -5 --tag1 accuracy
```

> Requires PRIVATE_KEY environment variable. Value is int128 (positive = good, negative = bad). Defaults to the Abstract mainnet reputation registry; override via --registry or REPUTATION_REGISTRY_ADDRESS.

### erc8004 reputation get

Get the reputation score for an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `REPUTATION_REGISTRY_ADDRESS` | `string` | no |  | Reputation registry contract address override (defaults on Abstract mainnet) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--registry` | `string` |  | Reputation registry contract address override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `totalScore` | `string` | yes |  |
| `count` | `number` | yes |  |
| `averageScore` | `string` | yes |  |

#### Examples

```sh
# Get reputation score for agent #1
erc8004 reputation get 1
```

> Defaults to the Abstract mainnet reputation registry. Override via --registry or REPUTATION_REGISTRY_ADDRESS.

### erc8004 reputation history

View feedback history for an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `REPUTATION_REGISTRY_ADDRESS` | `string` | no |  | Reputation registry contract address override (defaults on Abstract mainnet) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit` | `number` | `50` | Maximum number of results |
| `--registry` | `string` |  | Reputation registry contract address override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `history` | `array` | yes |  |
| `history[].index` | `number` | yes |  |
| `history[].from` | `string` | yes |  |
| `history[].value` | `number` | yes |  |
| `history[].tag1` | `string` | yes |  |
| `history[].tag2` | `string` | yes |  |
| `history[].fileUri` | `string` | yes |  |
| `history[].timestamp` | `string` | yes |  |
| `total` | `number` | yes |  |

#### Examples

```sh
# Show feedback history for agent #1
erc8004 reputation history 1

# Show last 10 feedbacks
erc8004 reputation history 1 --limit 10
```

> Defaults to the Abstract mainnet reputation registry. Override via --registry or REPUTATION_REGISTRY_ADDRESS.

## erc8004 validation

Manage ERC-8004 agent validation requests. Defaults to the Abstract mainnet validation registry deployment.

### erc8004 validation history

View validation request history for an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `VALIDATION_REGISTRY_ADDRESS` | `string` | no |  | Validation registry contract address override (defaults on Abstract mainnet) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--registry` | `string` |  | Validation registry contract address override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | yes |  |
| `requests` | `array` | yes |  |
| `requests[].requestId` | `string` | yes |  |
| `requests[].validator` | `string` | yes |  |
| `requests[].status` | `string` | yes |  |
| `requests[].timestamp` | `string` | yes |  |
| `total` | `number` | yes |  |

#### Examples

```sh
# View validation history for agent #1
erc8004 validation history 1
```

> Defaults to the Abstract mainnet validation registry. Override via --registry or VALIDATION_REGISTRY_ADDRESS.

### erc8004 validation request

Submit a validation request for an agent.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `agentId` | `string` | yes | Agent token ID to validate |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `VALIDATION_REGISTRY_ADDRESS` | `string` | no |  | Validation registry contract address override (defaults on Abstract mainnet) |
| `PRIVATE_KEY` | `string` | no |  | Private key for signing |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--validator` | `string` |  | Validator address |
| `--jobHash` | `string` |  | Job hash (bytes32 hex, 0x-prefixed) |
| `--registry` | `string` |  | Validation registry contract address override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | `string` | yes |  |
| `agentId` | `string` | yes |  |
| `validator` | `string` | yes |  |
| `txHash` | `string` | yes |  |

#### Examples

```sh
# Request validation for agent #1
erc8004 validation request 1 --validator 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --jobHash 0x0000000000000000000000000000000000000000000000000000000000000000
```

> Requires PRIVATE_KEY environment variable. jobHash must be a 0x-prefixed 32-byte hex string. Defaults to the Abstract mainnet validation registry; override via --registry or VALIDATION_REGISTRY_ADDRESS.

### erc8004 validation status

Get the status of a validation request.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `requestId` | `string` | yes | Validation request ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL |
| `VALIDATION_REGISTRY_ADDRESS` | `string` | no |  | Validation registry contract address override (defaults on Abstract mainnet) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--registry` | `string` |  | Validation registry contract address override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | `string` | yes |  |
| `agentId` | `string` | yes |  |
| `validator` | `string` | yes |  |
| `jobHash` | `string` | yes |  |
| `status` | `string` | yes |  |
| `result` | `string` | yes |  |
| `timestamp` | `string` | yes |  |

#### Examples

```sh
# Get status of request #1
erc8004 validation status 1
```

> Defaults to the Abstract mainnet validation registry. Override via --registry or VALIDATION_REGISTRY_ADDRESS.
