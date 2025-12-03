'use client';

import { AlertCircle } from 'lucide-react';

interface SwitchNetworkMessageProps {
    walletName?: string;
}

/**
 * Reusable component for displaying the "Switch to network" message
 */
export function SwitchNetworkMessage({ walletName }: SwitchNetworkMessageProps) {
    return (
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
}

