'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletDiscovery } from '@/hooks/use-wallet-discovery';
import { useNetworkSetupSteps } from '@/hooks/use-network-setup-steps';
import { AlertCircle } from 'lucide-react';
import {
    WalletSelector,
    ManualSetupSteps,
    ProgrammaticSetupSteps,
} from '@/components/network-checker';

const NetworkCheckerPage = () => {
    const { wallets, isLoading } = useWalletDiscovery();
    const [selectedWalletId, setSelectedWalletId] = useState<string>('');

    const setupSteps = useNetworkSetupSteps();

    // Get selected wallet
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    const isProgrammatic = selectedWallet?.rdns === 'io.metamask';

    // Reset step completion when wallet changes
    useEffect(() => {
        setupSteps.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWalletId, isProgrammatic]);

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-muted">
            <div className="relative z-10 container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl md:text-5xl font-bold">Network Checker</h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                            Configure your wallet to use Fast Protocol RPC.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Wallet Selector Dropdown */}
                        <WalletSelector
                            selectedWalletId={selectedWalletId}
                            onWalletChange={setSelectedWalletId}
                        />

                        {/* Setup Steps */}
                        {selectedWallet && (
                            <div className="space-y-6 p-6 rounded-xl border bg-card/60 backdrop-blur-sm border-border">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold">{selectedWallet.name} Setup</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {isProgrammatic
                                            ? 'Follow these steps to automatically configure your wallet'
                                            : 'Follow these steps to manually configure your wallet'}
                                    </p>
                                </div>

                                {isProgrammatic ? (
                                    <ProgrammaticSetupSteps
                                        steps={setupSteps.steps}
                                        isConnecting={setupSteps.isConnecting}
                                        isInstalling={setupSteps.isInstalling}
                                        isTesting={setupSteps.isTesting}
                                        onConnect={setupSteps.connectWallet}
                                        onInstall={setupSteps.installNetwork}
                                        onTest={setupSteps.testRPC}
                                    />
                                ) : (
                                    <ManualSetupSteps walletName={selectedWallet?.name} />
                                )}
                            </div>
                        )}

                        {!selectedWallet && wallets.length > 0 && (
                            <div className="text-center py-8 backdrop-blur-sm bg-card/60 border border-primary/20 rounded-2xl">
                                <p className="text-sm text-muted-foreground">
                                    Select a wallet from the dropdown above to see setup instructions
                                </p>
                            </div>
                        )}

                        {wallets.length === 0 && !isLoading && (
                            <div className="text-center py-12 backdrop-blur-sm bg-card/60 border border-primary/20 rounded-2xl">
                                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-lg font-semibold mb-2">No wallets detected</p>
                                <p className="text-sm text-muted-foreground">
                                    Please install a wallet extension to get started
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="text-center pt-8">
                        <Link
                            href="/"
                            className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                        >
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkCheckerPage;
