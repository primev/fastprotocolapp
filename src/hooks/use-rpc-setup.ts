import { useState, useEffect, useRef } from 'react';
import { Connector } from 'wagmi';
import { toast } from 'sonner';
import { NETWORK_CONFIG } from '@/lib/network-config';
import { getProviderForConnector } from '@/lib/wallet-provider';
import { isMetaMaskWallet } from '@/lib/onboarding-utils';
import { UseRPCTestReturn } from './use-rpc-test';

const RPC_REFRESH_FLAG_KEY = 'rpc-refresh-flag';

export interface UseRPCSetupProps {
  isConnected: boolean;
  connector: Connector | undefined;
  walletStepCompleted: boolean;
  hasInitialized: boolean;
  updateStepStatus: (stepId: string, completed: boolean) => void;
  rpcTest: UseRPCTestReturn;
  alreadyConfiguredWallet?: boolean;
}

export interface UseRPCSetupReturn {
  rpcAddCompleted: boolean;
  rpcTestCompleted: boolean;
  rpcRequired: boolean;
  refreshProcessed: boolean;
  setRpcAddCompleted: (value: boolean) => void;
  setRpcTestCompleted: (value: boolean) => void;
  setRpcRequired: (value: boolean) => void;
  handleAddRPC: () => Promise<void>;
  handleRefresh: () => void;
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
  alreadyConfiguredWallet = false,
}: UseRPCSetupProps): UseRPCSetupReturn {
  const [rpcAddCompleted, setRpcAddCompleted] = useState(false);
  const [rpcTestCompleted, setRpcTestCompleted] = useState(false);
  const [rpcRequired, setRpcRequired] = useState(false);
  const [refreshProcessed, setRefreshProcessed] = useState(false);
  const hasPromptedAddRpc = useRef(false);
  const refreshProcessedRef = useRef(false);
  const updateStepStatusRef = useRef(updateStepStatus);

  /**
   * Check if refresh flag exists in localStorage
   */
  const hasRefreshFlag = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(RPC_REFRESH_FLAG_KEY) === 'true';
    } catch {
      return false;
    }
  };

  /**
   * Set refresh flag in localStorage
   */
  const setRefreshFlag = (): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(RPC_REFRESH_FLAG_KEY, 'true');
    } catch (error) {
      console.error('Error setting refresh flag:', error);
    }
  };

  /**
   * Clear refresh flag from localStorage
   */
  const clearRefreshFlag = (): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(RPC_REFRESH_FLAG_KEY);
    } catch (error) {
      console.error('Error clearing refresh flag:', error);
    }
  };

  /**
   * Handle refresh button click - set flag and reload
   */
  const handleRefresh = (): void => {
    setRefreshFlag();
    window.location.reload();
  };

  // Check for refresh flag on initialization - check immediately, don't wait for connection
  useEffect(() => {
    if (!hasInitialized) return;
    
    // Check for flag immediately when initialized (after page reload)
    if (hasRefreshFlag()) {
      // Flag found - user clicked refresh, so set toggle/add as completed
      setRpcAddCompleted(true);
      setRefreshProcessed(true);
      refreshProcessedRef.current = true;
      clearRefreshFlag();
    }
  }, [hasInitialized]);

  // Also check when connection is established (in case flag check happened before connection)
  useEffect(() => {
    if (!hasInitialized || !isConnected) return;
    
    // Double-check for flag when connected (in case it wasn't processed earlier)
    if (hasRefreshFlag()) {
      // Flag found - user clicked refresh, so set toggle/add as completed
      setRpcAddCompleted(true);
      setRefreshProcessed(true);
      refreshProcessedRef.current = true;
      clearRefreshFlag();
    }
  }, [hasInitialized, isConnected]);

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

      // Only show toast for MetaMask if wallet is not already configured
      if (isMetaMaskWallet(connector) && !alreadyConfiguredWallet) {
        toast.success('Network added successfully', {
          description: 'Fast Protocol network has been added to your wallet.',
        });
      }
      
      setRpcAddCompleted(false);
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

  // Prompt Add Fast RPC after wallet connection
  useEffect(() => {
    if (!hasInitialized) return;

    // Wait until wallet is connected and we haven't prompted yet
    if (!isConnected || !connector || hasPromptedAddRpc.current) {
      return;
    }

    // Wait a moment after connection, then prompt
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
      
      // Don't auto-complete toggle/add step - user must manually mark it as complete
      setRpcAddCompleted(false);
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
          // Network already added
          return;
        }

        // Log other errors but don't show toast since popup appeared
        console.error('Network addition result:', error);
      }
    }, 1500); // Wait 1.5 seconds after connection

    return () => clearTimeout(timer);
  }, [isConnected, connector, hasInitialized]);

  // Mark test as complete when test is successful
  useEffect(() => {
    if (rpcTest.testResult?.success === true) {
      setRpcTestCompleted(true);
    }
  }, [rpcTest.testResult?.success]);

  // Ensure rpcAddCompleted is set when refreshProcessed is true
  useEffect(() => {
    if (refreshProcessed && !rpcAddCompleted) {
      setRpcAddCompleted(true);
    }
  }, [refreshProcessed, rpcAddCompleted]);

  // Update RPC step status when both Add and Test are completed, or reset on disconnect
  useEffect(() => {
    if (!hasInitialized) return;
    const rpcStepCompleted = rpcAddCompleted && rpcTestCompleted;

    if (!isConnected) {
      // Reset state and mark step as incomplete when disconnected
      hasPromptedAddRpc.current = false;
      setRpcRequired(false);
      // Don't reset refreshProcessed or rpcAddCompleted if refresh was processed
      // This preserves the state after refresh even if user disconnects
      const wasRefreshProcessed = refreshProcessedRef.current;
      if (!wasRefreshProcessed) {
        setRefreshProcessed(false);
      }
      // Don't reset if wallet is already configured (happy path) - keep rpcAddCompleted true
      // Also don't reset if refresh was processed - keep rpcAddCompleted true
      if (!alreadyConfiguredWallet && !wasRefreshProcessed) {
        setRpcAddCompleted(false);
        setRpcTestCompleted(false);
      } else {
        // Reset test completion but keep add completion
        setRpcTestCompleted(false);
      }
      updateStepStatusRef.current('rpc', false);
    } else if (rpcStepCompleted) {
      // Mark step as complete when both are done
      updateStepStatusRef.current('rpc', true);
    } else if (alreadyConfiguredWallet) {
      // If wallet is already configured, only set rpcAddCompleted to true
      // User must still complete the test step
      if (!rpcAddCompleted) {
        setRpcAddCompleted(true);
      }
      // Don't auto-set rpcTestCompleted - user must complete the test
    }
  }, [rpcAddCompleted, rpcTestCompleted, isConnected, hasInitialized, alreadyConfiguredWallet]);

  return {
    rpcAddCompleted,
    rpcTestCompleted,
    rpcRequired,
    refreshProcessed,
    setRpcAddCompleted,
    setRpcTestCompleted,
    setRpcRequired,
    handleAddRPC,
    handleRefresh,
  };
}
