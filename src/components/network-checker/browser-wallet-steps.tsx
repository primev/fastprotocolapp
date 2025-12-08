'use client';

import { useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FAST_PROTOCOL_NETWORK } from '@/lib/network-config';

interface BrowserWalletStepsProps {
    walletName?: string;
}

export function BrowserWalletSteps({ walletName }: BrowserWalletStepsProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const networkDetails = [
        { label: 'Network Name', value: FAST_PROTOCOL_NETWORK.chainName, field: 'name' },
        { label: 'RPC URL', value: FAST_PROTOCOL_NETWORK.rpcUrls[0], field: 'rpc' },
        { label: 'Chain ID', value: FAST_PROTOCOL_NETWORK.chainId.toString(), field: 'chainId' },
        { label: 'Currency Symbol', value: FAST_PROTOCOL_NETWORK.nativeCurrency.symbol, field: 'symbol' },
        { label: 'Block Explorer', value: FAST_PROTOCOL_NETWORK.blockExplorerUrls[0], field: 'explorer' },
    ];

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        1
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">
                        Open your {walletName || 'wallet'} wallet settings
                    </p>
                </div>

                <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        2
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">
                        Navigate to Networks or Network Settings
                    </p>
                </div>

                <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        3
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">
                        Click &quot;Add Network&quot; or &quot;Add Custom Network&quot;
                    </p>
                </div>

                <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        4
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">
                        Enter the network details below
                    </p>
                </div>
            </div>

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

            <div className="pt-3 border-t border-border">
                <div className="relative flex gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground mb-1">
                            Important: Switch to the network after adding
                        </p>
                        <p className="text-sm text-muted-foreground">
                            After adding the network, you may need to switch to it in your wallet before testing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
