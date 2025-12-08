'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
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

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} modalSize="compact" appInfo={{
          appName: 'Fast Protocol',
          disclaimer: Disclaimer,
        }}>
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
