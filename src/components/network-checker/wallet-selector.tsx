'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useWalletDiscovery, type DiscoveredWallet } from '@/hooks/use-wallet-discovery';

interface WalletSelectorProps {
    selectedWalletId: string;
    onWalletChange: (walletId: string) => void;
}

/**
 * Reusable wallet selector component
 */
export function WalletSelector({ selectedWalletId, onWalletChange }: WalletSelectorProps) {
    const { wallets, isLoading } = useWalletDiscovery();

    const programmaticWallets = wallets.filter(w => w.rdns === 'io.metamask');
    const manualWallets = wallets.filter(w => w.rdns !== 'io.metamask');

    if (isLoading) {
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium">Select Wallet</label>
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Select Wallet</label>
            <Select value={selectedWalletId} onValueChange={onWalletChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a wallet to configure" />
                </SelectTrigger>
                <SelectContent>
                    {programmaticWallets.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Programmatic</SelectLabel>
                            {programmaticWallets.map((wallet) => (
                                <WalletSelectItem key={wallet.id} wallet={wallet} />
                            ))}
                        </SelectGroup>
                    )}
                    {manualWallets.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Manual</SelectLabel>
                            {manualWallets.map((wallet) => (
                                <WalletSelectItem key={wallet.id} wallet={wallet} />
                            ))}
                        </SelectGroup>
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}

function WalletSelectItem({ wallet }: { wallet: DiscoveredWallet }) {
    return (
        <SelectItem value={wallet.id}>
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
    );
}

