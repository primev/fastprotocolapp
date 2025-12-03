import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getMetaMaskProvider } from '@/lib/wallet-provider';

export interface UseWalletConnectionReturn {
    isConnecting: boolean;
    isConnected: boolean;
    connect: () => Promise<boolean>;
}

/**
 * Hook for connecting to MetaMask wallet
 */
export function useWalletConnection(): UseWalletConnectionReturn {
    const { toast } = useToast();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const connect = async (): Promise<boolean> => {
        setIsConnecting(true);
        try {
            const provider = getMetaMaskProvider();
            
            if (!provider) {
                toast({
                    title: "No wallet provider found",
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

            // Request connection
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                setIsConnected(true);
                toast({
                    title: "Wallet connected",
                    description: "MetaMask is now connected.",
                });
                return true;
            }
            return false;
        } catch (error: any) {
            if (error.code === 4001) {
                toast({
                    title: "Connection cancelled",
                    description: "Please connect MetaMask to continue.",
                    variant: "default",
                });
            } else {
                toast({
                    title: "Connection failed",
                    description: error?.message || "Failed to connect wallet.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsConnecting(false);
        }
    };

    return {
        isConnecting,
        isConnected,
        connect,
    };
}

