import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from 'wagmi';
import { NETWORK_CONFIG } from '@/lib/network-config';

export interface UseNetworkInstallationReturn {
    isInstalling: boolean;
    isInstalled: boolean;
    install: () => Promise<boolean>;
    reset: () => void;
}


export function useNetworkInstallation(): UseNetworkInstallationReturn {
    const { toast } = useToast();
    const { connector } = useAccount();
    const [isInstalling, setIsInstalling] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    const install = async (): Promise<boolean> => {
        if (!connector) return false;

        setIsInstalling(true);
        try {
            const provider = (await connector.getProvider()) as any;

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
            if (error?.code !== 4001) {
                toast({
                    title: "Installation failed",
                    description: error?.message || "Failed to install network.",
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

