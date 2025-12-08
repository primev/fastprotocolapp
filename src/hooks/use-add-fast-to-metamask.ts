import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NETWORK_CONFIG } from '@/lib/network-config';

export interface UseAddFastToMetamaskReturn {
    isProcessing: boolean;
    addFastToMetamask: () => Promise<boolean>;
}

export function useAddFastToMetamask(): UseAddFastToMetamaskReturn {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const addFastToMetamask = async (): Promise<boolean> => {
        setIsProcessing(true);
        
        try {
            // Step 1: Check if MetaMask is installed - MUST verify before any calls
            if (typeof window === 'undefined') {
                toast({
                    title: "MetaMask not found",
                    description: "Please install MetaMask to continue.",
                    variant: "destructive",
                });
                setIsProcessing(false);
                return false;
            }

            // Safely check for MetaMask
            let provider = null;
            
            try {
                const ethereum = (window as any).ethereum;
                
                // If no ethereum provider at all, MetaMask is not installed
                if (!ethereum) {
                    toast({
                        title: "MetaMask not found",
                        description: "Please install MetaMask to continue.",
                        variant: "destructive",
                    });
                    setIsProcessing(false);
                    return false;
                }
                
                // Get MetaMask provider specifically (handle multiple providers)
                // First check: Does the main ethereum object have isMetaMask?
                const hasDirectMetaMask = ethereum.isMetaMask === true;
                
                // Second check: Are there multiple providers?
                const hasMultipleProviders = ethereum.providers && Array.isArray(ethereum.providers);
                
                if (hasMultipleProviders) {
                    // Look for MetaMask in the providers array
                    provider = ethereum.providers.find((p: any) => p && p.isMetaMask === true);
                } else if (hasDirectMetaMask) {
                    // Single provider and it's MetaMask
                    provider = ethereum;
                }
            } catch (checkError) {
                // If checking for MetaMask causes an error, MetaMask is not available
                toast({
                    title: "MetaMask not found",
                    description: "Please install MetaMask to continue.",
                    variant: "destructive",
                });
                setIsProcessing(false);
                return false;
            }

            // CRITICAL: If no MetaMask provider found, return early WITHOUT calling any provider methods
            // This prevents wallet selection modals from appearing
            if (!provider || provider.isMetaMask !== true) {
                toast({
                    title: "MetaMask not found",
                    description: "Please install MetaMask to continue.",
                    variant: "destructive",
                });
                setIsProcessing(false);
                return false;
            }

            // Step 2: Request connection if needed (MetaMask will show its own modal, no wallet selection)
            // Only call this on the confirmed MetaMask provider
            try {
                await provider.request({ method: 'eth_requestAccounts' });
            } catch (reqError: any) {
                if (reqError?.code === 4001) {
                    // User rejected connection
                    setIsProcessing(false);
                    return false;
                }
                throw reqError;
            }

            // Step 3: Add/update network
            // For existing networks (like Ethereum), this will update the RPC URL
            await provider.request({
                method: "wallet_addEthereumChain",
                params: [NETWORK_CONFIG],
            });

            toast({
                title: "Success!",
                description: "Fast Protocol RPC has been added to your wallet.",
            });
            
            return true;
        } catch (error: any) {
            // Error code 4001 means user rejected the request
            if (error?.code === 4001) {
                toast({
                    title: "Request cancelled",
                    description: "You cancelled the network addition request.",
                    variant: "default",
                });
            } else {
                toast({
                    title: "Failed to add network",
                    description: error?.message || "Failed to add Fast Protocol network to your wallet.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        isProcessing,
        addFastToMetamask,
    };
}
