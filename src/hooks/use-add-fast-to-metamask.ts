import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NETWORK_CONFIG } from '@/lib/network-config';

export interface UseAddFastToMetamaskReturn {
  isProcessing: boolean;
  addFastToMetamask: () => Promise<boolean>;
}

export function useAddFastToMetamask(): UseAddFastToMetamaskReturn {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const addFastToMetamask = async (): Promise<boolean> => {
    setIsProcessing(true);

    try {
      if (typeof window === 'undefined') {
        toast({
          title: "MetaMask not found",
          description: "Please install MetaMask to continue.",
          variant: "destructive",
        });
        return false;
      }

      // Safely check for MetaMask
      let provider = null;
      try {
        const ethereum = (window as any).ethereum;

        if (!ethereum) {
          toast({
            title: "MetaMask not found",
            description: "Please install MetaMask to continue.",
            variant: "destructive",
          });
          return false;
        }

        const hasDirectMetaMask = ethereum.isMetaMask === true;
        const hasMultipleProviders = ethereum.providers && Array.isArray(ethereum.providers);

        if (hasMultipleProviders) {
          provider = ethereum.providers.find((p: any) => p && p.isMetaMask === true);
        } else if (hasDirectMetaMask) {
          provider = ethereum;
        }
      } catch (checkError) {
        toast({
          title: "MetaMask not found",
          description: "Please install MetaMask to continue.",
          variant: "destructive",
        });
        return false;
      }

      if (!provider || provider.isMetaMask !== true) {
        toast({
          title: "MetaMask not found",
          description: "Please install MetaMask to continue.",
          variant: "destructive",
        });
        return false;
      }

      // Step 2: Disconnect all other wallets
      try {
        const ethereum = (window as any).ethereum;
        if (ethereum.providers && Array.isArray(ethereum.providers)) {
          // Disconnect all non-MetaMask providers
          for (const p of ethereum.providers) {
            if (p && p !== provider && p.isMetaMask !== true) {
              try {
                // Try to disconnect the wallet
                if (p.disconnect) {
                  await p.disconnect();
                }
                // Also try wallet_disconnect method
                if (p.request) {
                  try {
                    await p.request({ method: 'wallet_disconnect' });
                  } catch {
                    // Ignore errors - some wallets don't support this
                  }
                }
              } catch (disconnectError) {
                // Ignore disconnect errors - continue with MetaMask connection
                // eslint-disable-next-line no-console
                console.log('Could not disconnect wallet:', disconnectError);
              }
            }
          }
        }
      } catch (disconnectAllError) {
        // Ignore errors during disconnect - continue with MetaMask connection
        // eslint-disable-next-line no-console
        console.log('Error during wallet disconnection:', disconnectAllError);
      }

      // Step 3: Request connection with timeout
      const connectTimeout = 1000 * 30; // 30 seconds
      const connectPromise = provider.request({ method: 'eth_requestAccounts' });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MetaMask connection timed out. Please check other wallets are disconnected and try again.")), connectTimeout)
      );

      try {
        await Promise.race([connectPromise, timeoutPromise]);
      } catch (reqError: any) {
        if (reqError?.code === 4001) {
          // User rejected connection
          return false;
        }
        // Timeout or other error
        toast({
          title: "Connection issue",
          description: reqError.message || "Unable to connect to MetaMask. Please check other wallets.",
          variant: "destructive",
        });
        return false;
      }

      // Step 4: Add/update network
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [NETWORK_CONFIG],
      });

      return true;
    } catch (error: any) {
      if (error?.code === 4001) {
        toast({
          title: "Request cancelled",
          description: "You cancelled the network addition request.",
          variant: "default",
        });
      } else {
        toast({
          title: "Failed to add network",
          description: error?.message || "Failed to add Fast Protocol network to your wallet.",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    addFastToMetamask,
  };
}
