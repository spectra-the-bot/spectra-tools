import { http, createPublicClient, defineChain } from 'viem';

export const abstractMainnet = defineChain({
  id: 2741,
  name: 'Abstract Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.mainnet.abs.xyz'] },
    public: { http: ['https://api.mainnet.abs.xyz'] },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
});

export function createAssemblyPublicClient(rpcUrl?: string) {
  return createPublicClient({
    chain: abstractMainnet,
    transport: http(rpcUrl ?? process.env.ABSTRACT_RPC_URL ?? 'https://api.mainnet.abs.xyz'),
  });
}
