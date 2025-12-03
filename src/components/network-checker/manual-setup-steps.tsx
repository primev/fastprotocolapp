'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FAST_PROTOCOL_NETWORK } from '@/lib/network-config';
import { SwitchNetworkMessage } from './switch-network-message';

interface ManualSetupStepsProps {
    walletName?: string;
}

/**
 * Reusable component for manual wallet setup steps
 */
export function ManualSetupSteps({ walletName }: ManualSetupStepsProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const networkDetails = [
        { label: 'Network Name', value: FAST_PROTOCOL_NETWORK.chainName, field: 'name' },
        { label: 'RPC URL', value: FAST_PROTOCOL_NETWORK.rpcUrls[0], field: 'rpc' },
        { label: 'Chain ID', value: FAST_PROTOCOL_NETWORK.chainId.toString(), field: 'chainId' },
        { label: 'Currency Symbol', value: FAST_PROTOCOL_NETWORK.nativeCurrency.symbol, field: 'symbol' },
        { label: 'Block Explorer', value: `https://${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}`, field: 'explorer' },
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
            {/* Step-by-step instructions */}
            <div className="space-y-3">
                <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                        1
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">
                        Open your {walletName || 'wallet'} wallet settings
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
                <SwitchNetworkMessage walletName={walletName} />
            </div>
        </div>
    );
}

