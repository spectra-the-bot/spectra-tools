import { http, type PublicClient, createPublicClient, defineChain } from 'viem';

const DEFAULT_ABSTRACT_RPC_URL = 'https://api.mainnet.abs.xyz';

export const abstractMainnet = defineChain({
  id: 2741,
  name: 'Abstract Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [DEFAULT_ABSTRACT_RPC_URL] },
    public: { http: [DEFAULT_ABSTRACT_RPC_URL] },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
});

export function createAbstractClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: abstractMainnet,
    transport: http(rpcUrl ?? process.env.ABSTRACT_RPC_URL ?? DEFAULT_ABSTRACT_RPC_URL),
  });
}
