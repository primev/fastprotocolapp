import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

/**
 * Wagmi configuration that uses the injected provider (window.ethereum)
 * 
 * This configuration ensures that:
 * - All connectors (injected, metaMask, etc.) use window.ethereum directly
 * - When a wallet is connected, Wagmi uses the wallet's provider (injected provider)
 * - The wallet's configured RPC endpoint is always used, not Wagmi's default RPCs
 */
export const config = getDefaultConfig({
  appName: 'Fast Protocol',
  projectId,
  chains: [mainnet],
  ssr: true,
});
