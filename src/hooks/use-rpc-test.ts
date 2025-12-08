import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

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
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to query transaction status: ${response.status}`);
        }

        const result = await response.json();
        return {
            success: result.success,
            hash: result.hash || hash,
        };
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
    const { isConnected, address } = useAccount();
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    const {
        data: hash,
        isPending: isSending,
        isError: isSendError,
        error: sendError,
        sendTransaction,
        reset: resetSend,
    } = useSendTransaction();

    const {
        isLoading: isConfirming,
        isSuccess: isConfirmed,
        isError: isConfirmError,
        error: confirmError,
    } = useWaitForTransactionReceipt({
        hash,
    });

    // Update testing state based on transaction status
    useEffect(() => {
        if (isSending || isConfirming) {
            setIsTesting(true);
        } else if (isConfirmed || isSendError || isConfirmError) {
            setIsTesting(false);
        }
    }, [isSending, isConfirming, isConfirmed, isSendError, isConfirmError]);

    // Handle transaction success and query database
    useEffect(() => {
        if (isConfirmed && hash) {
            // Query database with transaction hash
            queryTransactionHash(hash)
                .then((result) => {
                    setTestResult({
                        success: result.success,
                        hash: result.hash,
                    });
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
                    toast({
                        title: "Test Completed",
                        description: "Transaction confirmed but database query failed.",
                        variant: "default",
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

    const test = () => {
        setTestResult(null);

        if (!isConnected) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return;
        }

        if (!address) {
            toast({
                title: "Address not available",
                description: "Please ensure your wallet is properly connected.",
                variant: "destructive",
            });
            return;
        }

        // This is a zero-value self-transfer to verify RPC connectivity
        try {
            const transactionPayload = {
                to: address as `0x${string}`, // Send to self (zero-value transfer)
                value: parseEther('0'), // Zero ETH - no funds transferred
                data: '0x' as `0x${string}`, // No data - simple transfer
            };
            sendTransaction(transactionPayload);
        } catch (error: any) {
            const isRejection = isUserRejection(error);
            const errorMessage = isRejection
                ? getRejectionMessage()
                : error?.message || "Failed to initiate transaction";

            setTestResult({
                success: false,
                hash: null,
            });

            toast({
                title: isRejection ? "Transaction Rejected" : "Test Failed",
                description: errorMessage,
                variant: "destructive",
            });
            setIsTesting(false);
        }
    };

    const reset = () => {
        setTestResult(null);
        setIsTesting(false);
        resetSend();
    };

    return {
        isTesting,
        testResult,
        test,
        reset,
    };
}

