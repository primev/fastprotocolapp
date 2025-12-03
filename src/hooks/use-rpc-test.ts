import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getMetaMaskProvider } from '@/lib/wallet-provider';
import { useAccount } from 'wagmi';

export interface UseRPCTestReturn {
    isTesting: boolean;
    isTestSuccessful: boolean;
    test: () => Promise<boolean>;
    reset: () => void;
}

/**
 * Hook for testing RPC connection by sending a zero-value transaction
 */
export function useRPCTest(): UseRPCTestReturn {
    const { toast } = useToast();
    const { address } = useAccount();
    const [isTesting, setIsTesting] = useState(false);
    const [isTestSuccessful, setIsTestSuccessful] = useState(false);

    // Listen for network/chain changes and reset test result
    useEffect(() => {
        const provider = getMetaMaskProvider();
        if (!provider?.on) return;

        const handleChainChanged = () => {
            setIsTestSuccessful(false);
        };

        provider.on('chainChanged', handleChainChanged);

        return () => {
            if (provider.removeListener) {
                provider.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, []);

    const test = async (): Promise<boolean> => {
        if (!address) {
            toast({
                title: "No wallet address",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return false;
        }

        setIsTesting(true);
        try {
            const provider = getMetaMaskProvider();

            if (!provider) {
                toast({
                    title: "MetaMask not found",
                    description: "Please install MetaMask extension.",
                    variant: "destructive",
                });
                return false;
            }

            if (!provider.isMetaMask) {
                toast({
                    title: "MetaMask not found",
                    description: "Please install and unlock MetaMask.",
                    variant: "destructive",
                });
                return false;
            }

            // Ensure address is in correct format
            const addressToUse = address.toLowerCase();

            // Get the current nonce for the transaction
            const nonce = await provider.request({
                method: 'eth_getTransactionCount',
                params: [addressToUse, 'latest'],
            });

            // Perform a zero-value transaction to self as a test
            const txHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: addressToUse,
                    to: addressToUse, // Send to self
                    value: '0x0', // Zero value
                    gas: '0x5208', // 21000 gas (standard transfer)
                    nonce: nonce,
                    maxFeePerGas: '0x3b9aca00', // 1 gwei (minimal fee to pass MetaMask validation)
                    maxPriorityFeePerGas: '0x3b9aca00', // 1 gwei (minimal priority fee)
                }],
            });

            setIsTestSuccessful(true);
            toast({
                title: "RPC connection successful",
                description: `Zero-value transaction sent successfully. TX Hash: ${txHash}`,
            });
            return true;
        } catch (error: any) {
            const errorCode = error?.code;
            const errorMessage = error?.message?.toLowerCase() || '';

            if (errorCode === 4001) {
                toast({
                    title: "Test cancelled",
                    description: "You cancelled the RPC test.",
                    variant: "default",
                });
            } else if (
                errorCode === -32601 ||
                errorCode === '-32601' ||
                (errorMessage.includes('method') && errorMessage.includes('not found'))
            ) {
                toast({
                    title: "RPC method not found",
                    description: "Please ensure you've switched MetaMask to the Fast Protocol network (Ethereum Mainnet with Fast Protocol RPC).",
                    variant: "destructive",
                });
            } else if (errorCode === 4100 || errorMessage.includes('unauthorized')) {
                toast({
                    title: "Wallet not connected",
                    description: "Please ensure your wallet is connected and unlocked.",
                    variant: "destructive",
                });
            } else {
                const fullErrorMessage = error?.message || error?.data || String(error);
                toast({
                    title: "RPC test failed",
                    description: fullErrorMessage || "Failed to test RPC connection. Please ensure you're connected to the Fast Protocol network in MetaMask.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsTesting(false);
        }
    };

    const reset = () => {
        setIsTestSuccessful(false);
    };

    return {
        isTesting,
        isTestSuccessful,
        test,
        reset,
    };
}

