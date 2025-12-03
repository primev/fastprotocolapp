import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWalletConnection } from './use-wallet-connection';
import { useNetworkInstallation } from './use-network-installation';
import { useRPCTest } from './use-rpc-test';

export interface NetworkSetupSteps {
    step1Completed: boolean;
    step2Completed: boolean;
    step3Completed: boolean;
}

export interface UseNetworkSetupStepsReturn {
    steps: NetworkSetupSteps;
    isConnecting: boolean;
    isInstalling: boolean;
    isTesting: boolean;
    connectWallet: () => Promise<void>;
    installNetwork: () => Promise<void>;
    testRPC: () => Promise<void>;
    reset: () => void;
}

/**
 * Composable hook that manages all network setup steps
 * Combines wallet connection, network installation, and RPC testing
 */
export function useNetworkSetupSteps(): UseNetworkSetupStepsReturn {
    const { address, isConnected } = useAccount();
    
    const walletConnection = useWalletConnection();
    const networkInstallation = useNetworkInstallation();
    const rpcTest = useRPCTest();

    const [step1Completed, setStep1Completed] = useState(false);
    const [step2Completed, setStep2Completed] = useState(false);
    const [step3Completed, setStep3Completed] = useState(false);

    // Sync step 1 with wallet connection state
    useEffect(() => {
        setStep1Completed(isConnected && !!address);
    }, [isConnected, address]);

    // Reset steps when wallet disconnects
    useEffect(() => {
        if (!isConnected) {
            setStep1Completed(false);
            setStep2Completed(false);
            setStep3Completed(false);
            networkInstallation.reset();
            rpcTest.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    // Sync step 2 with installation state
    useEffect(() => {
        setStep2Completed(networkInstallation.isInstalled);
    }, [networkInstallation.isInstalled]);

    // Sync step 3 with test state
    useEffect(() => {
        setStep3Completed(rpcTest.isTestSuccessful);
    }, [rpcTest.isTestSuccessful]);

    const connectWallet = async () => {
        const success = await walletConnection.connect();
        if (success) {
            setStep1Completed(true);
        }
    };

    const installNetwork = async () => {
        if (!step1Completed) return;
        const success = await networkInstallation.install();
        if (success) {
            setStep2Completed(true);
        }
    };

    const testRPC = async () => {
        if (!step2Completed) return;
        const success = await rpcTest.test();
        if (success) {
            setStep3Completed(true);
        }
    };

    const reset = useCallback(() => {
        setStep1Completed(false);
        setStep2Completed(false);
        setStep3Completed(false);
        networkInstallation.reset();
        rpcTest.reset();
    }, [networkInstallation, rpcTest]);

    return {
        steps: {
            step1Completed,
            step2Completed,
            step3Completed,
        },
        isConnecting: walletConnection.isConnecting,
        isInstalling: networkInstallation.isInstalling,
        isTesting: rpcTest.isTesting,
        connectWallet,
        installNetwork,
        testRPC,
        reset,
    };
}

