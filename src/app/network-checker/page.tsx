'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRPCTest } from '@/hooks/use-rpc-test';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { RabbySteps } from '@/components/network-checker/rabby-steps';
import { BrowserWalletSteps } from '@/components/network-checker/browser-wallet-steps';
import { ProgrammaticSetupSteps } from '@/components/network-checker/programmatic-setup-steps';
import { useWalletInfo } from '@/hooks/use-wallet-info';

const NetworkCheckerPage = () => {
    const { isConnected, chain, connector } = useAccount();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { walletName, walletIcon } = useWalletInfo(connector, isConnected);
    const rpcTest = useRPCTest();

    // Determine wallet type for drawer content
    const isMetaMask = connector?.id?.toLowerCase().includes('metamask');
    const isRabby = walletName?.toLowerCase().includes('rabby') ||
                    connector?.id?.toLowerCase().includes('rabby');

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-muted">
            <div className="relative z-10 container mx-auto px-4 py-12">
                <div className="flex flex-col items-center justify-center space-y-8">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl md:text-5xl font-bold">Network Checker</h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                            Configure your wallet to use Fast Protocol RPC.
                        </p>
                    </div>

                    <div className="flex flex-col items-center space-y-6">
                        {!isConnected ? (
                            <ConnectButton />
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="h-[44px] px-4 flex items-center gap-2"
                                        disabled
                                    >
                                        {walletIcon && (
                                            <img
                                                src={walletIcon}
                                                alt={walletName}
                                                className="w-5 h-5 rounded object-contain"
                                                onError={(e) => {
                                                    console.error('[Wallet Icon] Failed to load:', walletIcon);
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                                onLoad={() => {
                                                    console.log('[Wallet Icon] Successfully loaded:', walletIcon);
                                                }}
                                            />
                                        )}
                                        {walletName}
                                    </Button>
                                    <ConnectButton.Custom>
                                        {({ account, openAccountModal, openChainModal }) => (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    className="h-[44px] px-4"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (openChainModal) {
                                                            openChainModal();
                                                        }
                                                    }}
                                                >
                                                    {chain?.id === 1 ? (chain?.name || 'Network') : 'Wrong Network'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-[44px] w-[44px] p-0"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (openAccountModal) {
                                                            openAccountModal();
                                                        }
                                                    }}
                                                >
                                                    <Lock className="h-5 w-5" />
                                                </Button>
                                            </>
                                        )}
                                    </ConnectButton.Custom>
                                </div>
                            </div>
                        )}

                        {isConnected && (
                            <>
                                {chain?.id === 1 ? (
                                    <div className="inline-flex rounded-xl border-1 border-foreground/25 bg-card/50 backdrop-blur-sm overflow-hidden shadow-lg ring-2 ring-foreground/10">
                                        <Button
                                            onClick={() => setIsDrawerOpen(true)}
                                            size="lg"
                                            className="flex-1 rounded-none border-0 border-r border-foreground/20 px-8 font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                                            variant="ghost"
                                        >
                                            Setup
                                        </Button>
                                        <Button
                                            onClick={() => rpcTest.test()}
                                            size="lg"
                                            disabled={rpcTest.isTesting}
                                            className="flex-1 rounded-none px-8 font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                                            variant="ghost"
                                        >
                                            {rpcTest.isTesting ? 'Testing...' : 'Test'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="px-6 py-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-lg ring-1 ring-black/5 text-center">
                                        <p className="text-sm font-medium text-foreground">
                                            You must switch to Ethereum to continue.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2 mb-2">
                            {walletIcon && (
                                <img
                                    src={walletIcon}
                                    alt={walletName}
                                    className="w-10 h-10 rounded object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                            <span>Setup Instructions for {walletName}</span>
                        </SheetTitle>
                        <SheetDescription>
                            Follow these steps to configure your wallet with Fast Protocol RPC.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                        {isMetaMask ? (
                            <ProgrammaticSetupSteps />
                        ) : isRabby ? (
                            <RabbySteps />
                        ) : (
                            <BrowserWalletSteps walletName={walletName} />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
};

export default NetworkCheckerPage;
