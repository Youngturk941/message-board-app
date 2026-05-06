import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { injected } from 'wagmi/connectors';

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON'
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz']
    },
    public: {
      http: ['https://testnet-rpc.monad.xyz']
    }
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com'
    }
  },
  testnet: true
});

export const hasWalletConnectProjectId = Boolean(
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim()
);

const config = hasWalletConnectProjectId
  ? getDefaultConfig({
      appName: 'Message Board',
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      chains: [monadTestnet],
      transports: {
        [monadTestnet.id]: http('https://testnet-rpc.monad.xyz')
      }
    })
  : createConfig({
      chains: [monadTestnet],
      connectors: [injected()],
      multiInjectedProviderDiscovery: true,
      transports: {
        [monadTestnet.id]: http('https://testnet-rpc.monad.xyz')
      }
    });

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
