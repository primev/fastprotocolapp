'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Lock, AlertCircle, CheckCircle, XCircle, Zap, Settings, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRPCTest } from '@/hooks/use-rpc-test';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RabbySteps } from '@/components/network-checker/rabby-steps';
import { BrowserWalletSteps } from '@/components/network-checker/browser-wallet-steps';
import { ProgrammaticSetupSteps } from '@/components/network-checker/programmatic-setup-steps';
import { useWalletInfo } from '@/hooks/use-wallet-info';
import { FAST_PROTOCOL_NETWORK } from '@/lib/network-config';
import { useRouter } from 'next/navigation';

const NetworkCheckerPage = () => {
    const router = useRouter();
    const { isConnected, chain, connector } = useAccount();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const { walletName, walletIcon } = useWalletInfo(connector, isConnected);
    const rpcTest = useRPCTest();

    const handleTestClick = () => {
        setIsTestModalOpen(true);
    };

    const handleConfirmTest = () => {
        rpcTest.test();
    };

    const handleCloseModal = () => {
        setIsTestModalOpen(false);
        // Clear test result when modal closes
        rpcTest.reset();
    };


    // Determine wallet type for drawer content
    const isMetaMask = connector?.id?.toLowerCase().includes('metamask');
    const isRabby = walletName?.toLowerCase().includes('rabby') ||
                    connector?.id?.toLowerCase().includes('rabby');

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />

            <div className="relative z-10">
                {/* Header */}
                <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 bg-background/80 z-50">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                            <Zap className="w-6 h-6 text-primary" />
                            <span className="text-xl font-bold gradient-text">
                                FAST Protocol
                            </span>
                        </button>
                        <div className="flex items-center gap-4">
                            <Badge
                                variant="outline"
                                className="text-sm px-3 py-1.5 border-primary/50"
                            >
                                Network Checker
                            </Badge>
                        </div>
                    </div>
                </header>

                {/* Description Banner */}
                <div className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50">
                    <div className="container mx-auto px-4 py-3 text-center">
                        <p className="text-primary-foreground font-semibold">
                            Configure your wallet to use Fast Protocol RPC for faster transactions and better performance.
                        </p>
                    </div>
                </div>

                <main className="container mx-auto px-4 py-12 md:py-16 min-h-[calc(100vh-200px)] flex flex-col items-center justify-center">
                    <div className="w-full max-w-lg">
                        {/* Logo */}
                        <div className="flex justify-center">
                            <Image
                                src="/assets/fast-protocol-logo-icon.png"
                                alt="Fast Protocol"
                                width={350}
                                height={350}
                                priority
                                className="h-32 md:h-40 w-auto"
                            />
                        </div>

                        {/* Main Content */}
                        {!isConnected ? (
                            <div className="flex justify-center">
                                <ConnectButton.Custom>
                                    {({ account, chain, openConnectModal, mounted }) => {
                                        return (
                                            <Button
                                                variant="hero"
                                                size="lg"
                                                onClick={openConnectModal}
                                                className="h-12 px-8 lg:text-base"
                                            >
                                                Connect Wallet
                                            </Button>
                                        );
                                    }}
                                </ConnectButton.Custom>
                            </div>
                        ) : (
                            <Card className="p-6 md:p-8 bg-card/50 border-border/50">
                                <div className="flex flex-col items-center space-y-6">
                                    <div className="w-full space-y-6">
                                    {/* Wallet Info */}
                                    <div className="space-y-4">
                                        <h2 className="text-2xl font-semibold text-center">Wallet Connection</h2>
                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
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

                                    {/* Actions */}
                                    {chain?.id === 1 ? (
                                        <div className="space-y-4">
                                            <div className="text-center space-y-2">
                                                <h3 className="text-xl font-semibold">RPC Configuration</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Set up and test your Fast Protocol RPC connection.
                                                </p>
                                            </div>
                                            <div className="grid sm:grid-cols-1 gap-4">
                                                <Button
                                                    onClick={() => setIsDrawerOpen(true)}
                                                    size="lg"
                                                    className="w-full h-auto py-3 flex flex-col items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 relative"
                                                    variant="outline"
                                                >
                                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
                                                        1
                                                    </div>
                                                    <span className="font-semibold text-sm">Setup RPC</span>
                                                    <span className="text-xs text-muted-foreground">Configure your wallet</span>
                                                </Button>
                                                <Button
                                                    onClick={handleTestClick}
                                                    size="lg"
                                                    disabled={rpcTest.isTesting}
                                                    className="w-full h-auto py-3 flex flex-col items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 disabled:opacity-50 relative"
                                                    variant="outline"
                                                >
                                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
                                                        2
                                                    </div>
                                                    <span className="font-semibold text-sm">
                                                        {rpcTest.isTesting ? 'Testing...' : 'Test Connection'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">Verify RPC setup</span>
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Card className="p-6 bg-destructive/10 border-destructive/30">
                                            <div className="flex items-center gap-3">
                                                <AlertCircle className="w-5 h-5 text-destructive" />
                                                <p className="text-sm font-medium text-foreground">
                                                    You must switch to Ethereum to continue.
                                                </p>
                                            </div>
                                        </Card>
                                    )}
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                </main>
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

            {/* RPC Test Modal */}
            <Dialog 
                open={isTestModalOpen} 
                onOpenChange={(open) => {
                    if (!open) {
                        // Modal is closing - clear state
                        setIsTestModalOpen(false);
                        rpcTest.reset();
                    } else if (!rpcTest.isTesting) {
                        setIsTestModalOpen(open);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md border-primary/50">
                    {rpcTest.testResult ? (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                        rpcTest.testResult.success 
                                            ? 'bg-green-500/10' 
                                            : 'bg-destructive/10'
                                    }`}>
                                        {rpcTest.testResult.success ? (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-destructive" />
                                        )}
                                    </div>
                                    <DialogTitle>
                                        {rpcTest.testResult.success ? 'Test Successful' : 'Test Failed'}
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-left pt-2">
                                    {rpcTest.testResult.success ? (
                                        <p className="mb-4">
                                            Fast Protocol RPC connection was successfully verified.
                                        </p>
                                    ) : (
                                        <p className="mb-4">
                                            The RPC connection test failed. Please check your configuration and try again.
                                        </p>
                                    )}
                                    {rpcTest.testResult.hash && (
                                        <div className="pt-2">
                                            <a
                                                href={`${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}tx/${rpcTest.testResult.hash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                            >
                                                View transaction on Etherscan
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button 
                                    onClick={handleCloseModal} 
                                    className="w-full"
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                        <AlertCircle className="h-5 w-5 text-primary" />
                                    </div>
                                    <DialogTitle>RPC Connection Test</DialogTitle>
                                </div>
                                <DialogDescription className="text-left pt-2">
                                    <p className="mb-4">
                                        To verify that your RPC is properly configured, a test transaction will be performed.
                                    </p>
                                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                        <p className="text-sm font-medium text-foreground">Transaction Details:</p>
                                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                            <li>Zero value transaction (0 ETH)</li>
                                            <li>No funds will be transferred</li>
                                            <li>Only verifies RPC connectivity</li>
                                        </ul>
                                    </div>
                                    <p className="mt-4 text-sm">
                                        You will need to approve this transaction in your wallet to complete the test.
                                    </p>
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    variant="outline"
                                    onClick={handleCloseModal}
                                    disabled={rpcTest.isTesting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleConfirmTest}
                                    disabled={rpcTest.isTesting}
                                >
                                    {rpcTest.isTesting ? 'Testing...' : 'Continue Test'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default NetworkCheckerPage;
