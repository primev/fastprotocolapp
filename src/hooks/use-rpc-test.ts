import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from 'wagmi';

export interface UseRPCTestReturn {
    isTesting: boolean;
    test: () => void;
}

export function useRPCTest(): UseRPCTestReturn {
    const { toast } = useToast();
    const { isConnected } = useAccount();
    const [isTesting, setIsTesting] = useState(false);

    const test = () => {
        if (!isConnected) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return;
        }

        setIsTesting(true);
        
        // Simulate test delay
        setTimeout(() => {
            const success = Math.random() > 0.5;
            setIsTesting(false);
            const message = success ? "Fast Protocol RPC connection was successful" : "Fast Protocol RPC connection has failed";

            toast({
                title: success ? "Test Successful" : "Test Failed",
                description: message,
                variant: success ? "default" : "destructive",
            });
        }, 1000);
    };

    return {
        isTesting,
        test,
    };
}

