'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { FAST_PROTOCOL_NETWORK } from '@/lib/network-config';

interface NetworkDetail {
  label: string;
  value: string;
  field: string;
}

/**
 * Component to display network details with copy-to-clipboard functionality
 */
export function NetworkDetailsTab() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const networkDetails: NetworkDetail[] = [
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
    <div className="space-y-2">
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
  );
}
