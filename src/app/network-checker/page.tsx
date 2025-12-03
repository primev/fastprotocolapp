'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useWalletDiscovery } from '@/hooks/use-wallet-discovery';
import { NETWORK_CONFIG, FAST_PROTOCOL_NETWORK } from '@/lib/network-config';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Copy, Check, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccount } from 'wagmi';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const NetworkCheckerPage = () => {
    const { wallets, isLoading } = useWalletDiscovery();
    const { toast } = useToast();
    const { address, isConnected } = useAccount();

    const [selectedWalletId, setSelectedWalletId] = useState<string>('');
    const [step1Completed, setStep1Completed] = useState(false);
    const [step2Completed, setStep2Completed] = useState(false);
    const [step3Completed, setStep3Completed] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);



    // Listen for network/chain changes and reset step 3
    useEffect(() => {
        const win = window as any;
        if (!win.ethereum) return;

        // Get MetaMask provider
        let provider: any = win.ethereum;
        if (Array.isArray(provider)) {
            provider = provider.find((p: any) => p.isMetaMask) || provider[0];
        } else if (provider.providers && Array.isArray(provider.providers)) {
            provider = provider.providers.find((p: any) => p.isMetaMask) || provider.providers[0];
        }

        if (!provider?.request) return;

        // Listen for chain changes and reset step 3 completion
        const handleChainChanged = () => {
            setStep3Completed(false);
        };

        provider.on('chainChanged', handleChainChanged);
            
            return () => {
                if (provider.removeListener) {
                provider.removeListener('chainChanged', handleChainChanged);
                }
            };
    }, [isConnected]);


    // Step 1: Approve wallet request (for programmatic setup)
    const handleStep1Connect = async () => {
        setIsConnecting(true);
        try {
            const win = window as any;
            if (!win.ethereum) {
            toast({
                    title: "No wallet provider found",
                    description: "Please install MetaMask extension.",
                variant: "destructive",
            });
            return;
        }

            // Get MetaMask provider
        let provider: any = win.ethereum;
        if (Array.isArray(provider)) {
                provider = provider.find((p: any) => p.isMetaMask) || provider[0];
            } else if (provider.providers && Array.isArray(provider.providers)) {
                provider = provider.providers.find((p: any) => p.isMetaMask) || provider.providers[0];
        }
        
            if (!provider?.request || !provider.isMetaMask) {
            toast({
                    title: "MetaMask not found",
                    description: "Please install and unlock MetaMask.",
                variant: "destructive",
            });
            return;
        }
        
            // Request connection
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                setStep1Completed(true);
                toast({
                    title: "Wallet connected",
                    description: "MetaMask is now connected.",
                });
            }
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
        } finally {
            setIsConnecting(false);
        }
    };

    // Step 2: Add network using NETWORK_CONFIG (for programmatic setup)
    const handleStep2Install = async () => {
        setIsInstalling(true);
        try {
            const win = window as any;
            if (!win.ethereum) {
                toast({
                    title: "MetaMask not found",
                    description: "Please install MetaMask extension.",
                    variant: "destructive",
                });
                return;
            }

            // Get MetaMask provider
            let provider: any = win.ethereum;
            if (Array.isArray(provider)) {
                provider = provider.find((p: any) => p.isMetaMask) || provider[0];
            } else if (provider.providers && Array.isArray(provider.providers)) {
                provider = provider.providers.find((p: any) => p.isMetaMask) || provider.providers[0];
            }

            if (!provider?.request || !provider.isMetaMask) {
                toast({
                    title: "MetaMask not found",
                    description: "Please install and unlock MetaMask.",
                    variant: "destructive",
                });
                return;
            }

            // Add network
            await provider.request({
                method: "wallet_addEthereumChain",
                params: [NETWORK_CONFIG],
            });
            
            setStep2Completed(true);
            toast({
                title: "Network installed successfully",
                description: "Fast Protocol network has been added to MetaMask.",
            });
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
                setStep2Completed(true);
                toast({
                    title: "Network already installed",
                    description: "Fast Protocol network is already configured in MetaMask.",
                });
            } else {
                toast({
                    title: "Installation failed",
                    description: errorMessage || "Failed to install network. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsInstalling(false);
        }
    };

    // Step 3: Test RPC connection (for programmatic setup)
    const handleStep3Test = async () => {
        console.log('[NetworkCheckerPage] Handling step 3 test');
        if (!address) {
            toast({
                title: "No wallet address",
                description: "Please connect your wallet first.",
                variant: "destructive",
            });
            return;
        }

        setIsTesting(true);
        try {
            const win = window as any;
            if (!win.ethereum) {
            toast({
                    title: "MetaMask not found",
                    description: "Please install MetaMask extension.",
                    variant: "destructive",
            });
            return;
        }

            // Get MetaMask provider
            let provider: any = win.ethereum;
            if (Array.isArray(provider)) {
                provider = provider.find((p: any) => p.isMetaMask) || provider[0];
            } else if (provider.providers && Array.isArray(provider.providers)) {
                provider = provider.providers.find((p: any) => p.isMetaMask) || provider.providers[0];
            }

            console.log('[NetworkCheckerPage] Provider:', provider);
            console.log('[NetworkCheckerPage] Address:', address);

            if (!provider?.request || !provider.isMetaMask) {
                toast({
                    title: "MetaMask not found",
                    description: "Please install and unlock MetaMask.",
                    variant: "destructive",
                });
                return;
            }

            // Ensure address is in correct format
            const addressToUse = address?.toLowerCase();
            console.log('[NetworkCheckerPage] Testing RPC with zero-value transaction to:', addressToUse);

            // Get the current nonce for the transaction
            const nonce = await provider.request({
                method: 'eth_getTransactionCount',
                params: [addressToUse, 'latest'],
            });

            // Perform a zero-value transaction to self as a test
            const txHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: addressToUse,
                    to: addressToUse, // Send to self
                    value: '0x0', // Zero value
                    gas: '0x5208', // 21000 gas (standard transfer)
                    nonce: nonce, 
                    maxFeePerGas: '0x3b9aca00', // 1 gwei (minimal fee to pass MetaMask validation)
                    maxPriorityFeePerGas: '0x3b9aca00', // 1 gwei (minimal priority fee)
                }],
            });
            console.log('[NetworkCheckerPage] Transaction sent successfully, hash:', txHash);

            setStep3Completed(true);
                toast({
                title: "RPC connection successful",
                description: `Zero-value transaction sent successfully. TX Hash: ${txHash}`,
                });
            } catch (error: any) {
            console.error('[NetworkCheckerPage] RPC test error:', error);
            console.error('[NetworkCheckerPage] Error details:', {
                code: error?.code,
                message: error?.message,
                data: error?.data,
                stack: error?.stack,
            });
            
            const errorCode = error?.code;
                const errorMessage = error?.message?.toLowerCase() || '';
            const errorData = error?.data || '';

            if (errorCode === 4001) {
                toast({
                    title: "Test cancelled",
                    description: "You cancelled the RPC test.",
                    variant: "default",
                });
            } else if (
                errorCode === -32601 ||
                errorCode === '-32601' ||
                (errorMessage.includes('method') && errorMessage.includes('not found'))
            ) {
                    toast({
                    title: "RPC method not found",
                    description: "The mevcommit_getBalance method is not available. Please ensure you've switched MetaMask to the Fast Protocol network (Ethereum Mainnet with Fast Protocol RPC).",
                    variant: "destructive",
                });
            } else if (errorCode === 4100 || errorMessage.includes('unauthorized')) {
                    toast({
                    title: "Wallet not connected",
                    description: "Please ensure your wallet is connected and unlocked.",
                    variant: "destructive",
                    });
                } else {
                const fullErrorMessage = error?.message || error?.data || String(error);
                toast({
                    title: "RPC test failed",
                    description: fullErrorMessage || "Failed to test RPC connection. Please ensure you're connected to the Fast Protocol network in MetaMask.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsTesting(false);
        }
    };

    // Copy to clipboard helper
    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };
    

    // Separate wallets into Programmatic (MetaMask) and Manual (others)
    const programmaticWallets = wallets.filter(w => w.rdns === 'io.metamask');
    const manualWallets = wallets.filter(w => w.rdns !== 'io.metamask');
    
    // Get selected wallet
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    const isProgrammatic = selectedWallet?.rdns === 'io.metamask';
    
    // Reset step completion when wallet changes and check current state
    useEffect(() => {
        if (selectedWalletId && isProgrammatic) {
            // Check if wallet is already connected
            if (isConnected && address) {
                setStep1Completed(true);
                } else {
                setStep1Completed(false);
            }
            setStep2Completed(false);
            setStep3Completed(false);
        } else {
            setStep1Completed(false);
            setStep2Completed(false);
            setStep3Completed(false);
        }
    }, [selectedWalletId, isConnected, address, isProgrammatic]);

    // Network details for manual setup
    const networkDetails = [
        { label: 'Network Name', value: FAST_PROTOCOL_NETWORK.chainName, field: 'name' },
        { label: 'RPC URL', value: FAST_PROTOCOL_NETWORK.rpcUrls[0], field: 'rpc' },
        { label: 'Chain ID', value: FAST_PROTOCOL_NETWORK.chainId.toString(), field: 'chainId' },
        { label: 'Currency Symbol', value: FAST_PROTOCOL_NETWORK.nativeCurrency.symbol, field: 'symbol' },
        { label: 'Block Explorer', value: `https://${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}`, field: 'explorer' },
    ];

    // Reusable component for "Switch to network" message
    const SwitchNetworkMessage = ({ walletName }: { walletName?: string }) => (
        <div className="flex gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-1">
                    Important: Switch to the network after adding
                </p>
                <p className="text-sm text-muted-foreground">
                    {walletName 
                        ? `After adding the network, switch to it in ${walletName} (click the network name in ${walletName} and select the Fast Protocol network) before testing the RPC connection.`
                        : 'After adding the network, switch to it in your wallet and return here to test the connection.'}
                </p>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Wallet</label>
                        {isLoading ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a wallet to configure" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {programmaticWallets.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>Programmatic</SelectLabel>
                                                {programmaticWallets.map((wallet) => (
                                                    <SelectItem key={wallet.id} value={wallet.id}>
                                                        <div className="flex items-center gap-2">
                                                            {wallet.icon && (
                                                                <img
                                                                    src={wallet.icon}
                                                                    alt={wallet.name}
                                                                    className="w-5 h-5 rounded"
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
                                                            <span>{wallet.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}
                                        {manualWallets.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>Manual</SelectLabel>
                                                {manualWallets.map((wallet) => (
                                                    <SelectItem key={wallet.id} value={wallet.id}>
                                                        <div className="flex items-center gap-2">
                                                            {wallet.icon && (
                                                                <img
                                                                    src={wallet.icon}
                                                                    alt={wallet.name}
                                                                    className="w-5 h-5 rounded"
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
                                                            <span>{wallet.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

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
                                    /* Programmatic Setup Steps */
                                    <div className="space-y-4">
                                        {/* Step 1: Approve wallet request */}
                                        <div className="flex gap-4 items-start">
                                            <div className={cn(
                                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                                                step1Completed 
                                                    ? "bg-green-500/20 text-green-500" 
                                                    : "bg-primary/20 text-primary"
                                            )}>
                                                {step1Completed ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium">Approve wallet request</p>
                                                    {step1Completed && (
                                                        <span className="text-xs text-green-500">Completed</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Connect your MetaMask wallet to continue.
                                                </p>
                                                {!step1Completed && (
                                                    <Button
                                                        onClick={handleStep1Connect}
                                                        disabled={isConnecting}
                                                        size="sm"
                                                    >
                                                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Step 2: Automatically add network */}
                                        <div className="flex gap-4 items-start">
                                            <div className={cn(
                                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                                                step2Completed 
                                                    ? "bg-green-500/20 text-green-500" 
                                                    : step1Completed
                                                    ? "bg-primary/20 text-primary"
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {step2Completed ? <CheckCircle2 className="w-5 h-5" /> : '2'}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium">Automatically add network</p>
                                                    {step2Completed && (
                                                        <span className="text-xs text-green-500">Completed</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Add the Fast Protocol network to your wallet automatically.
                                                </p>
                                                {!step2Completed && (
                                                    <Button
                                                        onClick={handleStep2Install}
                                                        disabled={!step1Completed || isInstalling}
                                                        size="sm"
                                                    >
                                                        {isInstalling ? 'Installing...' : 'Add Network'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Important: Switch to network */}
                                        {step2Completed && !step3Completed && (
                                            <div className="pt-2">
                                                <SwitchNetworkMessage walletName="MetaMask" />
                                            </div>
                                        )}

                                        {/* Step 3: Test RPC connection */}
                                        <div className="flex gap-4 items-start">
                                            <div className={cn(
                                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                                                step3Completed 
                                                    ? "bg-green-500/20 text-green-500" 
                                                    : step2Completed
                                                    ? "bg-primary/20 text-primary"
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {step3Completed ? <CheckCircle2 className="w-5 h-5" /> : '3'}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium">Test RPC connection</p>
                                                    {step3Completed && (
                                                        <span className="text-xs text-green-500">Completed</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Test the Fast Protocol RPC connection by sending a zero-value transaction to yourself.
                                                </p>
                                               
                                                {!step3Completed && (
                                                    <Button
                                                        onClick={handleStep3Test}
                                                        disabled={!step2Completed || isTesting}
                                                        size="sm"
                                                    >
                                                        {isTesting ? 'Testing...' : 'Test RPC'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Manual Setup Steps */
                                    <div className="space-y-6">
                                        {/* Step-by-step instructions */}
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                                                    1
                                                </div>
                                                <p className="text-sm text-muted-foreground flex-1">
                                                    Open your {selectedWallet.name} wallet settings
                                                </p>
                                            </div>

                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                                                    2
                                                </div>
                                                <p className="text-sm text-muted-foreground flex-1">
                                                    Navigate to Networks or Network Settings
                                                </p>
                                            </div>

                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                                                    3
                                                </div>
                                                <p className="text-sm text-muted-foreground flex-1">
                                                    Click &quot;Add Network&quot; or &quot;Add Custom Network&quot;
                                                </p>
                                            </div>

                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                                                    4
                                                </div>
                                                <p className="text-sm text-muted-foreground flex-1">
                                                    Enter the network details below
                                                </p>
                                            </div>
                                        </div>

                                        {/* Network details with copy buttons */}
                                        <div className="space-y-2 pt-3 border-t border-border">
                                            <h3 className="font-semibold text-sm mb-2">Network Details</h3>
                                            {networkDetails.map((detail) => (
                                                <div
                                                    key={detail.field}
                                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-muted-foreground mb-0.5">{detail.label}</p>
                                                        <p className="text-xs font-mono break-all">{detail.value}</p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="ml-2 h-7 w-7 p-0"
                                                        onClick={() => copyToClipboard(detail.value, detail.field)}
                                                    >
                                                        {copiedField === detail.field ? (
                                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                    </div>
                                ))}
                            </div>

                                        {/* Important message */}
                                        <div className="pt-3 border-t border-border">
                                            <SwitchNetworkMessage walletName={selectedWallet?.name} />
                                        </div>
                                    </div>
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

