import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { config } from '@/lib/wagmi';

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
    const { toast } = useToast();
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
                    toast({
                        title: "Test Successful",
                        description: "Fast Protocol RPC connection was successful. Transaction confirmed.",
                        variant: "default",
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
                    toast({
                        title: "Test Failed",
                        description: "RPC connection test failed.",
                        variant: "destructive",
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

            toast({
                title: isRejection ? "Transaction Rejected" : "Test Failed",
                description: errorMessage,
                variant: "destructive",
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
            toast({
                title: "Test Failed",
                description: `RPC connection test failed: ${errorMessage}`,
                variant: "destructive",
            });
            resetSend();
        }
    }, [isConfirmError, confirmError, hash, toast, resetSend]);

    const test = async () => {
        setTestResult(null);
        resetSend();

        if (!isConnected || !address || !connector) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return;
        }

        setIsSending(true);
        setIsSendError(false);
        setSendError(null);

        try {
            // getWalletClient already bypasses window.ethereum - no need to disable interceptors
            const walletClient = await getWalletClient(config, { connector });

            if (!walletClient) {
                throw new Error('Wallet client not available');
            }

            const txParams = {
                to: address,
                value: BigInt(0),
                gas: BigInt(21000),
                maxFeePerGas: BigInt(30000000000),
                maxPriorityFeePerGas: BigInt(0),
            };
            const txHash = await walletClient.sendTransaction(txParams as any);
            setHash(txHash as `0x${string}`);
            setIsSending(false);
        } catch (error: any) {
            setIsSending(false);
            setIsSendError(true);
            setSendError(error);

            const isRejection = isUserRejection(error);
            const errorMessage = isRejection ? getRejectionMessage() : error?.message || "Failed to initiate transaction";

            console.log('errorMessage', errorMessage);
            setTestResult({ success: false, hash: null });
            setIsTesting(false);
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
