import { useEffect } from 'react';
import { useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { toast } from 'sonner';
import { Connector } from 'wagmi';

export interface UseWalletConnectionProps {
  isConnected: boolean;
  connector: Connector | undefined;
  walletStepCompleted: boolean;
  hasInitialized: boolean;
  updateStepStatus: (stepId: string, completed: boolean) => void;
  setRpcRequired: (value: boolean) => void;
  rpcRequired: boolean;
  alreadyConfiguredWallet?: boolean;
}

export interface UseWalletConnectionReturn {
  // This hook mainly handles side effects, but could expose connection state if needed
}

/**
 * Hook to manage wallet connection/disconnection logic and network switching
 */
export function useWalletConnection({
  isConnected,
  connector,
  walletStepCompleted,
  hasInitialized,
  updateStepStatus,
  setRpcRequired,
  rpcRequired,
  alreadyConfiguredWallet = false,
}: UseWalletConnectionProps): UseWalletConnectionReturn {
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Initialize: disconnect wallet on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      disconnect();
      if (connector) {
        connector.disconnect?.();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update wallet step status when connection changes
  useEffect(() => {
    if (!hasInitialized) return;

    if (isConnected && !walletStepCompleted && !rpcRequired) {
      updateStepStatus('wallet', true);
      setRpcRequired(false); // Reset when wallet reconnects
    } else if (!isConnected && walletStepCompleted) {
      updateStepStatus('wallet', false);
      setRpcRequired(false); // Reset when disconnected
    }
  }, [isConnected, walletStepCompleted, hasInitialized, updateStepStatus, setRpcRequired, rpcRequired]);

  // Update Ethereum network after wallet step is marked as successful
  useEffect(() => {
    if (!walletStepCompleted || !isConnected || !connector) {
      return;
    }

    // Wait for chainId to be available
    if (chainId === undefined) {
      return;
    }

    if (chainId !== mainnet.id && !alreadyConfiguredWallet) {
      // Not on mainnet - prompt to switch (only if wallet is not already configured)
      if (switchChain) {
        try {
          switchChain({ chainId: mainnet.id });
          toast.info('Switching to Ethereum Mainnet...', {
            description: 'Please approve the network switch in your wallet.',
          });
        } catch (error: any) {
          if (error?.code !== 4001) {
            toast.error('Failed to switch network', {
              description: 'Please manually switch to Ethereum Mainnet in your wallet to continue.',
            });
          }
        }
      }
    }
  }, [walletStepCompleted, isConnected, chainId, switchChain, connector, alreadyConfiguredWallet]);

  return {};
}
