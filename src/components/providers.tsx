'use client';

import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount } from 'wagmi';
import { DisclaimerComponent, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const Disclaimer: DisclaimerComponent = ({ Text }) => (
  <Text>
    By connecting your wallet, you are about to experience the fastest way to send transactions on Ethereum with Fast Protocol.
  </Text>
);

// Component to handle wallet disconnection and clear localStorage globally
function WalletDisconnectHandler() {

  // Helper function to clear wallet data from localStorage
  const clearWalletData = () => {
    localStorage.removeItem('genesisSBTTokenId');
    localStorage.removeItem('onboardingSteps');
    localStorage.removeItem('completedTasks');
  };

  // Helper function to refresh the page
  const refreshPage = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const { isConnected, address } = useAccount();
  const previousConnectedRef = useRef<boolean | null>(null);

  // Listen for external wallet disconnection events (manual disconnect from wallet)
  // This is a backup for cases where wagmi doesn't immediately detect manual disconnections
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      // If accounts array is empty, wallet was disconnected
      if (accounts.length === 0) {
        clearWalletData();
        refreshPage();
      }
    };

    const handleDisconnect = () => {
      clearWalletData();
      refreshPage();
    };

    // Listen to window.ethereum events for manual disconnections
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      // Handle accountsChanged event (most common - fires when accounts change or disconnect)
      if (ethereum.on) {
        ethereum.on('accountsChanged', handleAccountsChanged);
        ethereum.on('disconnect', handleDisconnect);
      } else if (ethereum.addEventListener) {
        // Some wallets use addEventListener instead of on
        ethereum.addEventListener('accountsChanged', handleAccountsChanged);
        ethereum.addEventListener('disconnect', handleDisconnect);
      }

      // Also check if it's a provider array (multiple wallets like Rabby + MetaMask)
      if (ethereum.providers && Array.isArray(ethereum.providers)) {
        ethereum.providers.forEach((provider: any) => {
          if (provider) {
            if (provider.on) {
              provider.on('accountsChanged', handleAccountsChanged);
              provider.on('disconnect', handleDisconnect);
            } else if (provider.addEventListener) {
              provider.addEventListener('accountsChanged', handleAccountsChanged);
              provider.addEventListener('disconnect', handleDisconnect);
            }
          }
        });
      }
    }

    return () => {
      if (ethereum) {
        if (ethereum.removeListener) {
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
          ethereum.removeListener('disconnect', handleDisconnect);
        } else if (ethereum.removeEventListener) {
          ethereum.removeEventListener('accountsChanged', handleAccountsChanged);
          ethereum.removeEventListener('disconnect', handleDisconnect);
        }
        
        if (ethereum.providers && Array.isArray(ethereum.providers)) {
          ethereum.providers.forEach((provider: any) => {
            if (provider) {
              if (provider.removeListener) {
                provider.removeListener('accountsChanged', handleAccountsChanged);
                provider.removeListener('disconnect', handleDisconnect);
              } else if (provider.removeEventListener) {
                provider.removeEventListener('accountsChanged', handleAccountsChanged);
                provider.removeEventListener('disconnect', handleDisconnect);
              }
            }
          });
        }
      }
    };
  }, []);

  // Also clear when wagmi state shows disconnected (backup)
  useEffect(() => {
    if (!isConnected && !address) {
      clearWalletData();
    }
  }, [isConnected, address]);

  return null;
}


export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} modalSize="compact" appInfo={{
          appName: 'Fast Protocol',
          disclaimer: Disclaimer,
        }}>
          <WalletDisconnectHandler />
          <TooltipProvider>
            {children}
            <Toaster />
            <Sonner />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
