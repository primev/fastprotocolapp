import { useState, useEffect, useRef } from 'react';
import { Connector } from 'wagmi';
import { toast } from 'sonner';
import { NETWORK_CONFIG } from '@/lib/network-config';
import { getProviderForConnector } from '@/lib/wallet-provider';
import { isMetaMaskWallet } from '@/lib/onboarding-utils';
import { UseRPCTestReturn } from './use-rpc-test';

export interface UseRPCSetupProps {
  isConnected: boolean;
  connector: Connector | undefined;
  walletStepCompleted: boolean;
  hasInitialized: boolean;
  updateStepStatus: (stepId: string, completed: boolean) => void;
  rpcTest: UseRPCTestReturn;
}

export interface UseRPCSetupReturn {
  rpcAddCompleted: boolean;
  rpcTestCompleted: boolean;
  rpcRequired: boolean;
  setRpcAddCompleted: (value: boolean) => void;
  setRpcTestCompleted: (value: boolean) => void;
  setRpcRequired: (value: boolean) => void;
  handleAddRPC: () => Promise<void>;
}

/**
 * Hook to manage RPC setup state and auto-prompting
 */
export function useRPCSetup({
  isConnected,
  connector,
  walletStepCompleted,
  hasInitialized,
  updateStepStatus,
  rpcTest,
}: UseRPCSetupProps): UseRPCSetupReturn {
  const [rpcAddCompleted, setRpcAddCompleted] = useState(false);
  const [rpcTestCompleted, setRpcTestCompleted] = useState(false);
  const [rpcRequired, setRpcRequired] = useState(false);
  const hasPromptedAddRpc = useRef(false);
  const updateStepStatusRef = useRef(updateStepStatus);
  
  // Keep ref in sync with latest function
  useEffect(() => {
    updateStepStatusRef.current = updateStepStatus;
  }, [updateStepStatus]);

  /**
   * Attempt to add RPC network to wallet
   */
  const handleAddRPC = async (): Promise<void> => {
    if (!connector) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet first.',
      });
      return;
    }

    try {
      // Wait a bit for provider to be fully ready
      await new Promise(resolve => setTimeout(resolve, 300));

      // Get provider directly from connector - this is the active provider that can show prompts
      let provider = null;
      try {
        provider = await connector.getProvider();
      } catch (error) {
        console.error('Error getting provider from connector:', error);
      }

      // Fallback to getProviderForConnector if connector.getProvider fails
      if (!provider) {
        provider = await getProviderForConnector(connector);
      }

      // Final fallback to window.ethereum (most reliable for showing prompts)
      if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        // If it's an array, use the first provider (usually the active one)
        provider = Array.isArray(ethereum) ? ethereum[0] : ethereum;
      }

      if (!provider) {
        toast.error('Provider not available', {
          description: 'Unable to access wallet provider.',
        });
        return;
      }

      // Verify provider has request method
      if (!provider.request || typeof provider.request !== 'function') {
        toast.error('Provider not ready', {
          description: 'Wallet provider is not ready. Please try again.',
        });
        return;
      }

      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [NETWORK_CONFIG],
      });
      
      // Only show toast for MetaMask
      if (isMetaMaskWallet(connector)) {
        toast.success('Network added successfully', {
          description: 'Fast Protocol network has been added to your wallet.',
        });
        // Mark toggle and test as completed for MetaMask
        setRpcAddCompleted(true);
        setRpcTestCompleted(true);
      } else {
        setRpcAddCompleted(true);
      }
      setRpcRequired(false);
      updateStepStatus('wallet', true);
    } catch (error: any) {
      if (error?.code === 4001) {
        // User rejected - keep warning state
        return;
      }
      toast.error('Failed to add network', {
        description: error?.message || 'Failed to add Fast Protocol network.',
      });
    }
  };

  // Prompt Add Fast RPC after wallet step is marked complete
  useEffect(() => {
    if (!hasInitialized) return;

    // Wait until wallet step is completed and we haven't prompted yet
    if (!walletStepCompleted || !isConnected || !connector || hasPromptedAddRpc.current) {
      return;
    }

    // Wait a moment after step is marked complete, then prompt
    const timer = setTimeout(async () => {
      if (!connector) return;

      hasPromptedAddRpc.current = true;

      try {
        // Use robust utility function to get the correct provider
        const provider = await getProviderForConnector(connector);
        if (!provider) {
          return;
        }

        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [NETWORK_CONFIG],
        });
        
        // Only show toast for MetaMask
        if (isMetaMaskWallet(connector)) {
          toast.success('Network added successfully', {
            description: 'Fast Protocol network has been added to your wallet.',
          });
        }
        setRpcRequired(false);
      } catch (error: any) {
        // Handle user rejection - mark step 5 as incomplete and show warning
        if (error?.code === 4001) {
          // User rejected - mark wallet step as incomplete and show warning
          updateStepStatusRef.current('wallet', false);
          setRpcRequired(true);
          return;
        }

        const errorMessage = error?.message?.toLowerCase() || '';
        const isNetworkExistsError =
          errorMessage.includes('already') ||
          errorMessage.includes('exists') ||
          errorMessage.includes('duplicate');

        if (isNetworkExistsError) {
          // Network already added - that's fine
          return;
        }

        // Log other errors but don't show toast since popup appeared
        console.error('Network addition result:', error);
      }
    }, 1500); // Wait 1.5 seconds after step is marked complete

    return () => clearTimeout(timer);
  }, [walletStepCompleted, isConnected, connector, hasInitialized]);

  // Mark test as complete when test is successful
  useEffect(() => {
    if (rpcTest.testResult?.success === true) {
      setRpcTestCompleted(true);
    }
  }, [rpcTest.testResult?.success]);

  // Update RPC step status when both Add and Test are completed, or reset on disconnect
  useEffect(() => {
    if (!hasInitialized) return;
    const rpcStepCompleted = rpcAddCompleted && rpcTestCompleted;
    
    if (!isConnected) {
      // Reset state and mark step as incomplete when disconnected
      hasPromptedAddRpc.current = false;
      setRpcRequired(false);
      setRpcAddCompleted(false);
      setRpcTestCompleted(false);
      updateStepStatusRef.current('rpc', false);
    } else if (rpcStepCompleted) {
      // Mark step as complete when both are done
      updateStepStatusRef.current('rpc', true);
    }
  }, [rpcAddCompleted, rpcTestCompleted, isConnected, hasInitialized]);

  return {
    rpcAddCompleted,
    rpcTestCompleted,
    rpcRequired,
    setRpcAddCompleted,
    setRpcTestCompleted,
    setRpcRequired,
    handleAddRPC,
  };
}
