import { useState } from 'react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { NETWORK_CONFIG } from '@/lib/network-config';

export interface UseNetworkInstallationReturn {
    isInstalling: boolean;
    isInstalled: boolean;
    install: () => Promise<boolean>;
    reset: () => void;
}


export function useNetworkInstallation(): UseNetworkInstallationReturn {
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
            toast.success("Network installed successfully", {
                description: "Fast Protocol network has been added to MetaMask.",
            });
            return true;
        } catch (error: any) {
            if (error?.code !== 4001) {
                toast.error("Installation failed", {
                    description: error?.message || "Failed to install network.",
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

