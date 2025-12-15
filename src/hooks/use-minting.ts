import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Address, PublicClient, TransactionReceipt } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, } from 'wagmi';
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

  // Handle transaction receipt and parse token ID
  useEffect(() => {
    if (!receipt) return;
    console.log('receipt', receipt);

    const tokenId = parseTokenIdFromReceipt(receipt);
    if (!tokenId) {
      return;
    }

    router.push(`/dashboard?tokenId=${tokenId.toString()}`);
  }, [receipt]);



  // Update minting state based on transaction status
  useEffect(() => {
    if (isWriting || isConfirming) {
      setIsMinting(true);
      return;
    }

    if (isWriteError || isConfirmError) {
      setIsMinting(false);
      const error = writeError || confirmError;
      console.log('error', error);

      if (error?.message?.toLowerCase().includes('user')) {
        toast.error('Claiming Failed', {
          description: 'User cancelled the transaction',
        });
        return;
      } else {
        toast.error('Claiming Failed', {
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
