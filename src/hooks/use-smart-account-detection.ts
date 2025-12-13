import { useState, useEffect } from 'react';
import { Address, PublicClient } from 'viem';

export interface UseSmartAccountDetectionProps {
  isConnected: boolean;
  address: Address | undefined;
  publicClient: PublicClient | undefined;
}

export interface UseSmartAccountDetectionReturn {
  isSmartAccount: boolean;
  isSmartAccountModalOpen: boolean;
  smartAccountNotComplete: boolean;
  setIsSmartAccountModalOpen: (open: boolean) => void;
  setSmartAccountNotComplete: (value: boolean) => void;
}

/**
 * Hook to detect if the connected wallet is a smart account
 */
export function useSmartAccountDetection({
  isConnected,
  address,
  publicClient,
}: UseSmartAccountDetectionProps): UseSmartAccountDetectionReturn {
  const [isSmartAccountModalOpen, setIsSmartAccountModalOpen] = useState(false);
  const [smartAccountNotComplete, setSmartAccountNotComplete] = useState(false);

  useEffect(() => {
    const checkSmartAccount = async () => {
      if (!isConnected || !address || !publicClient) {
        return;
      }

      try {
        // Check if address has code (is a smart contract/account)
        const code = await publicClient.getCode({
          address: address,
          blockTag: 'latest',
        });

        console.log('address', address);
        console.log('code', code);

        // If code exists and is not empty (not just "0x"), it's a smart account
        // Check for code length > 2 to account for "0x" prefix
        if (code && code !== '0x' && code !== '0x0' && code.length > 2) {
          console.log('Smart account detected, code:', code.substring(0, 20) + '...');
          setIsSmartAccountModalOpen(true);
          // Reset the not complete state when a new smart account is detected
          setSmartAccountNotComplete(false);
        } else {
          // Not a smart account, reset the state
          setSmartAccountNotComplete(false);
        }
      } catch (error) {
        console.error('Error checking smart account:', error);
      }
    };

    // Add a small delay to ensure wallet is fully connected
    const timer = setTimeout(() => {
      checkSmartAccount();
    }, 500);

    return () => clearTimeout(timer);
  }, [isConnected, address, publicClient]);

  const isSmartAccount = smartAccountNotComplete || isSmartAccountModalOpen;

  return {
    isSmartAccount,
    isSmartAccountModalOpen,
    smartAccountNotComplete,
    setIsSmartAccountModalOpen,
    setSmartAccountNotComplete,
  };
}
