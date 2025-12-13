import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { mainnet } from 'wagmi/chains';
import { createWalletClient, custom, type Address } from 'viem';
import { getProviderForConnector, getWalletTypeFromConnector } from '@/lib/wallet-provider';

export interface TestResult {
    success: boolean;
    hash: string | null;
}

export interface UseRPCTestReturn {
    isTesting: boolean;
    testResult: TestResult | null;
    test: () => void;
    reset: () => void;
}

// Query transaction status from Fast RPC API
async function queryTransactionHash(hash: string): Promise<{ success: boolean; hash: string }> {
    try {
        const response = await fetch(`/api/transaction-status/${hash}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to query transaction status: ${response.status}`);
        }

        const result = await response.json();
        return { success: result.success, hash: result.hash || hash };
    } catch (error) {
        console.error('Error querying transaction hash:', error);
        throw error;
    }
}

// Helper function to check if error is a user rejection
function isUserRejection(error: any): boolean {
    if (!error) return false;
    const errorMessage = error.message?.toLowerCase() || error.toString().toLowerCase() || '';
    return errorMessage.includes('reject') ||
        errorMessage.includes('user rejected') ||
        errorMessage.includes('user denied') ||
        errorMessage.includes('user cancelled') ||
        errorMessage.includes('4001') || // MetaMask rejection code
        errorMessage.includes('action_cancelled');
}

// Get clean error message for user rejection
function getRejectionMessage(): string {
    return "Transaction was rejected. The RPC test was cancelled.";
}

export function useRPCTest(): UseRPCTestReturn {
    const { isConnected, address, connector } = useAccount();
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [isQueryingAPI, setIsQueryingAPI] = useState(false);
    const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
    const [isSending, setIsSending] = useState(false);
    const [isSendError, setIsSendError] = useState(false);
    const [sendError, setSendError] = useState<Error | null>(null);

    const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isConfirmError, error: confirmError } =
        useWaitForTransactionReceipt({ hash });

    // Update testing state based on transaction status and API query
    useEffect(() => {
        if (isSending || isConfirming || isQueryingAPI) setIsTesting(true);
        else if (isConfirmed || isSendError || isConfirmError) {
            if (!isQueryingAPI) setIsTesting(false);
        }
    }, [isSending, isConfirming, isConfirmed, isSendError, isConfirmError, isQueryingAPI]);

    const resetSend = () => {
        setHash(undefined);
        setIsSending(false);
        setIsSendError(false);
        setSendError(null);
    };

    // Handle transaction success and query database
    useEffect(() => {
        if (isConfirmed && hash) {
            setIsQueryingAPI(true);
            queryTransactionHash(hash)
                .then((result) => {
                    setTestResult({
                        success: result.success,
                        hash: result.hash,
                    });
                    setIsQueryingAPI(false);
                    setIsTesting(false);
                    toast.success("Test Successful", {
                        description: "Fast Protocol RPC connection was successful. Transaction confirmed.",
                    });
                })
                .catch((error) => {
                    console.error('Database query failed:', error);
                    setTestResult({
                        success: false,
                        hash: hash,
                    });
                    setIsQueryingAPI(false);
                    setIsTesting(false);
                    toast.error("Test Failed", {
                        description: "RPC connection test failed.",
                    });
                });
        }
    }, [isConfirmed, hash, toast]);

    // Handle transaction errors
    useEffect(() => {
        if (isSendError && sendError) {
            const isRejection = isUserRejection(sendError);
            const errorMessage = isRejection
                ? getRejectionMessage()
                : sendError.message || "Failed to send transaction";

            setTestResult({
                success: false,
                hash: null,
            });

            toast.error(isRejection ? "Transaction Rejected" : "Test Failed", {
                description: errorMessage,
            });
            resetSend();
        }
    }, [isSendError, sendError, toast, resetSend]);

    useEffect(() => {
        if (isConfirmError && confirmError) {
            const errorMessage = confirmError.message || "Transaction confirmation failed";
            setTestResult({
                success: false,
                hash: hash || null,
            });
            toast.error("Test Failed", {
                description: `RPC connection test failed: ${errorMessage}`,
            });
            resetSend();
        }
    }, [isConfirmError, confirmError, hash, toast, resetSend]);

    const test = async () => {
        setTestResult(null);
        resetSend();

        if (!isConnected || !address || !connector) {
            toast.error("Wallet not connected", {
                description: "Please connect your wallet first.",
            });
            return;
        }

        setIsSending(true);
        setIsSendError(false);
        setSendError(null);

        try {
            // Get the specific provider for the connected wallet to avoid conflicts
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

            // Final fallback to window.ethereum (most reliable)
            if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
                const ethereum = (window as any).ethereum;
                // If it's an array, find the correct provider
                if (Array.isArray(ethereum)) {
                    // Try to find the provider that matches the connector
                    const walletType = getWalletTypeFromConnector(connector);
                    if (walletType === 'metamask') {
                        provider = ethereum.find((p: any) => p && p.isMetaMask === true && !p.isRabby);
                    } else if (walletType === 'rabby') {
                        provider = ethereum.find((p: any) => p && p.isRabby === true);
                    }
                    // Fallback to first provider if not found
                    if (!provider) {
                        provider = ethereum[0];
                    }
                } else {
                    provider = ethereum;
                }
            }

            if (!provider) {
                throw new Error('Provider not available');
            }

            // Verify provider has request method
            if (!provider.request || typeof provider.request !== 'function') {
                throw new Error('Provider not ready');
            }

            // Create a wallet client with the specific provider
            const walletClient = createWalletClient({
                account: address as Address,
                chain: mainnet,
                transport: custom(provider),
            });

            // Send transaction using the specific provider
            const txHash = await walletClient.sendTransaction({
                to: address as Address,
                value: BigInt(0),
                maxPriorityFeePerGas: BigInt(0),
            } as any);
            setHash(txHash);
            setIsSending(false);
        } catch (error: any) {
            setIsSending(false);
            setIsSendError(true);
            setSendError(error);

            const isRejection = isUserRejection(error);
            const errorMessage = isRejection ? getRejectionMessage() : error?.message || "Failed to initiate transaction";

            console.error('Transaction error:', errorMessage, error);
            setTestResult({ success: false, hash: null });
            setIsTesting(false);
            
            // Reset state on error to allow retry
            setTimeout(() => {
                resetSend();
            }, 1000);
        }
    };

    const reset = () => {
        setTestResult(null);
        setIsTesting(false);
        setIsQueryingAPI(false);
        resetSend();
        setHash(undefined);
    };

    return { isTesting, testResult, test, reset };
}
