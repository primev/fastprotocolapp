'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  WalletInfo, 
  RPCConfiguration, 
  NetworkSetupDrawer, 
  RPCTestModal 
} from '@/components/network-checker';
import { useRouter } from 'next/navigation';

const NetworkCheckerPage = () => {
    const router = useRouter();
    const { isConnected } = useAccount();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);

    const handleTestClick = () => {
        setIsTestModalOpen(true);
    };

    const handleConfirmTest = () => {
        // The test is handled by the RPCTestModal component internally
    };

    const handleCloseModal = () => {
        setIsTestModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />

            <div className="relative z-10">
                {/* Header */}
                <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 bg-background/80 z-50">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <Image
                            src="/assets/fast-protocol-logo-icon.png"
                            alt="Fast Protocol"
                            width={150}
                            height={150}
                        />
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
                                        <WalletInfo title="Wallet Connection" />
                                        <RPCConfiguration
                                            onSetupClick={() => setIsDrawerOpen(true)}
                                            onTestClick={handleTestClick}
                                        />
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                </main>
            </div>

            <NetworkSetupDrawer
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
            />

            <RPCTestModal
                open={isTestModalOpen}
                onOpenChange={setIsTestModalOpen}
                onConfirm={handleConfirmTest}
                onClose={handleCloseModal}
            />
        </div>
    );
};

export default NetworkCheckerPage;
