import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Address, PublicClient, TransactionReceipt } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/lib/contract-config';
import { parseTokenIdFromReceipt } from '@/lib/onboarding-utils';

export interface UseMintingProps {
  isConnected: boolean;
  address: Address | undefined;
  publicClient: PublicClient | undefined;
}

export interface UseMintingReturn {
  isMinting: boolean;
  alreadyMinted: boolean;
  existingTokenId: string | null;
  handleMintSbt: () => Promise<void>;
}

/**
 * Hook to manage minting transaction state and existing token checking
 */
export function useMinting({
  isConnected,
  address,
  publicClient,
}: UseMintingProps): UseMintingReturn {
  const router = useRouter();
  const [isMinting, setIsMinting] = useState(false);
  const [alreadyMinted, setAlreadyMinted] = useState(false);
  const [existingTokenId, setExistingTokenId] = useState<string | null>(null);

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    isError: isWriteError,
    error: writeError,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash });

  // Check if user already has a token minted on page load
  useEffect(() => {
    const checkExistingToken = async () => {
      if (!address || !publicClient) {
        setAlreadyMinted(false);
        setExistingTokenId(null);
        return;
      }

      try {
        const tokenId = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'getTokenIdByAddress',
          args: [address],
          blockTag: 'latest',
        } as any) as bigint;

        // Check if tokenId is valid (not zero)
        if (tokenId && tokenId > BigInt(0)) {
          setAlreadyMinted(false); // Todo: Change to true
          setExistingTokenId(tokenId.toString());
        } else {
          setAlreadyMinted(false);
          setExistingTokenId(null);
        }
      } catch (error) {
        console.error('Error checking existing token:', error);
        setAlreadyMinted(false);
        setExistingTokenId(null);
      }
    };

    checkExistingToken();
  }, [address, publicClient]);

  // Handle transaction confirmation with polling for logs
  useEffect(() => {
    if (!isConfirmed || !hash || !address || !publicClient) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 30; // Poll for up to 30 seconds (30 attempts * 1 second)
    const POLL_INTERVAL_MS = 1000; // Poll every 1 second

    const handleReceipt = async (): Promise<boolean> => {
      // Prefer the wagmi receipt if available
      let currentReceipt: TransactionReceipt | null = (receipt as TransactionReceipt | null) || null;

      // If logs are missing, refetch from RPC (Smart Account delay)
      if (!currentReceipt?.logs || currentReceipt.logs.length === 0) {
        try {
          currentReceipt = await publicClient.getTransactionReceipt({
            hash: hash,
          });
        } catch {
          // Receipt not indexed yet — return false to continue polling
          return false;
        }
      }

      if (!currentReceipt?.logs || currentReceipt.logs.length === 0) {
        // Still no logs — return false to continue polling
        return false;
      }

      const tokenId = parseTokenIdFromReceipt(currentReceipt);
      if (!tokenId) {
        // No token ID found — return false to continue polling
        return false;
      }

      // Success! Stop polling and handle success
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      setIsMinting(false);

      toast.success('Genesis SBT minted successfully!', {
        description: `Token ID: ${tokenId.toString()}`,
      });

      router.push(`/dashboard?tokenId=${tokenId.toString()}`);
      return true;
    };

    // Try immediately first
    handleReceipt().then((success) => {
      if (success) return;

      // If logs are missing, start polling
      pollInterval = setInterval(async () => {
        pollAttempts++;
        
        if (pollAttempts >= MAX_POLL_ATTEMPTS) {
          // Stop polling after max attempts
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          setIsMinting(false);
          toast.error('Transaction confirmed but logs not found', {
            description: 'The transaction was confirmed but we could not retrieve the token ID. Please check your wallet.',
          });
          return;
        }

        const success = await handleReceipt();
        if (success && pollInterval) {
          clearInterval(pollInterval);
        }
      }, POLL_INTERVAL_MS);
    });

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isConfirmed, hash, receipt, address, publicClient, router]);

  // Update minting state based on transaction status
  useEffect(() => {
    if (isWriting || isConfirming) {
      setIsMinting(true);
      return;
    }

    if (isWriteError || isConfirmError) {
      setIsMinting(false);
      const error = writeError || confirmError;

      if (error?.message?.includes('user')) {
        toast.error('Minting Failed', {
          description: 'User cancelled the minting',
        });
        return;
      } else {
        toast.error('Minting Failed', {
          description: 'Check RPC connection and try again',
        });
        return;
      }
    }
  }, [isWriting, isConfirming, isWriteError, isConfirmError, writeError, confirmError]);

  const handleMintSbt = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsMinting(true);

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'mint',
      } as unknown as any);
    } catch (error: any) {
      console.log('error', error);
      setIsMinting(false);

      toast.error('Transaction Failed', {
        description: error?.message || 'An unknown error occurred',
      });
    }
  };

  return {
    isMinting,
    alreadyMinted,
    existingTokenId,
    handleMintSbt,
  };
}
