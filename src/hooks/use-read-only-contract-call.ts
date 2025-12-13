import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { RPC_ENDPOINT } from '@/lib/network-config';
import { useWalletProvider } from '@/hooks/use-wallet-provider';

export interface UseReadOnlyContractCallProps {
  contractAddress: string;
  abi: readonly any[] | any[];
  functionName: string;
  args?: any[];
  enabled?: boolean;
}

export interface UseReadOnlyContractCallReturn<T = any> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for making read-only contract calls using ethers
 * Attempts to use wallet provider first, falls back to RPC endpoint
 */
export function useReadOnlyContractCall<T = any>({
  contractAddress,
  abi,
  functionName,
  args = [],
  enabled = true,
}: UseReadOnlyContractCallProps): UseReadOnlyContractCallReturn<T> {
  const { connector } = useAccount();
  const { provider: walletProvider, isLoading: isLoadingProvider } = useWalletProvider(connector);
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchKeyRef = useRef<string>('');

  // Memoize args to prevent unnecessary refetches
  const argsString = useMemo(() => JSON.stringify(args), [args]);
  const stableArgs = useMemo(() => args, [argsString]);

  // Create a unique key for this fetch based on all dependencies
  const fetchKey = useMemo(
    () => `${contractAddress}-${functionName}-${argsString}-${enabled}-${!!walletProvider}`,
    [contractAddress, functionName, argsString, enabled, walletProvider]
  );

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    // Wait for provider to load if still loading
    if (isLoadingProvider) {
      return;
    }

    // Prevent duplicate fetches with the same key
    if (lastFetchKeyRef.current === fetchKey && data !== null) {
      return;
    }

    setIsLoading(true);
    setError(null);
    lastFetchKeyRef.current = fetchKey;

    try {
      // Get provider from wallet provider or use RPC endpoint directly
      let provider: ethers.Provider;
      
      if (walletProvider) {
        try {
          provider = new ethers.BrowserProvider(walletProvider as any);
        } catch (error) {
          console.error('Error setting up wallet provider, using RPC endpoint:', error);
          // Fallback to JsonRpcProvider with explicit network config
          provider = new ethers.JsonRpcProvider(RPC_ENDPOINT, {
            chainId: 1,
            name: 'mainnet',
          });
        }
      } else {
        // Fallback to JsonRpcProvider with explicit network config
        provider = new ethers.JsonRpcProvider(RPC_ENDPOINT, {
          chainId: 1,
          name: 'mainnet',
        });
      }
      
      const contract = new ethers.Contract(
        contractAddress,
        abi as any[],
        provider
      );

      const result = await contract[functionName](...stableArgs);
      
      // Convert BigNumber to bigint if needed
      const processedResult = result && typeof result === 'object' && 'toString' in result
        ? BigInt(result.toString())
        : result;

      setData(processedResult as T);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
      lastFetchKeyRef.current = ''; // Allow retry on error
      console.error(`Error calling ${functionName}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, abi, functionName, stableArgs, enabled, walletProvider, isLoadingProvider, fetchKey]);

  useEffect(() => {
    fetchData();
  }, [fetchKey, isLoadingProvider, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

