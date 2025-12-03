import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getMetaMaskProvider } from '@/lib/wallet-provider';
import { NETWORK_CONFIG } from '@/lib/network-config';

export interface UseNetworkInstallationReturn {
    isInstalling: boolean;
    isInstalled: boolean;
    install: () => Promise<boolean>;
    reset: () => void;
}

/**
 * Hook for installing network to MetaMask
 */
export function useNetworkInstallation(): UseNetworkInstallationReturn {
    const { toast } = useToast();
    const [isInstalling, setIsInstalling] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    const install = async (): Promise<boolean> => {
        setIsInstalling(true);
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

            // Add network
            await provider.request({
                method: "wallet_addEthereumChain",
                params: [NETWORK_CONFIG],
            });

            setIsInstalled(true);
            toast({
                title: "Network installed successfully",
                description: "Fast Protocol network has been added to MetaMask.",
            });
            return true;
        } catch (error: any) {
            const errorCode = error?.code;
            const errorMessage = error?.message?.toLowerCase() || "";

            if (errorCode === 4001) {
                toast({
                    title: "Installation cancelled",
                    description: "You cancelled the network installation.",
                });
            } else if (
                errorCode === 4902 ||
                errorMessage.includes("already") ||
                errorMessage.includes("exists") ||
                errorMessage.includes("duplicate")
            ) {
                setIsInstalled(true);
                toast({
                    title: "Network already installed",
                    description: "Fast Protocol network is already configured in MetaMask.",
                });
                return true;
            } else {
                toast({
                    title: "Installation failed",
                    description: errorMessage || "Failed to install network. Please try again.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsInstalling(false);
        }
    };

    const reset = () => {
        setIsInstalled(false);
    };

    return {
        isInstalling,
        isInstalled,
        install,
        reset,
    };
}

