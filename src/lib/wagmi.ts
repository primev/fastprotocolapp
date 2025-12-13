import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rabbyWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http, unstable_connector, fallback } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';


const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [injectedWallet],
    },
  ],
  {
    appName: 'Fast Protocol',
    projectId: '00000000000000000000000000000000',
  }
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,       // Data becomes stale immediately
      gcTime: 0,          // No cache garbage collection timer
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

export const config = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: fallback([
      unstable_connector(injected), // This will use the custom RPC endpoint for the wallet
      http(), // This will use the default RPC endpoint
    ]),
  },
  ssr: true,
});
