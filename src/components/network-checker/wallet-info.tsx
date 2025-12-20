'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useWalletInfo } from '@/hooks/use-wallet-info';

interface WalletInfoProps {
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center';
}

export function WalletInfo({ 
  title, 
  size = 'md',
  align = 'center' 
}: WalletInfoProps) {
  const { chain, connector } = useAccount();
  const { walletName, walletIcon } = useWalletInfo(connector, true);

  const buttonHeight = size === 'sm' ? 'h-[36px]' : 'h-[44px]';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const titleSize = size === 'sm' ? 'text-lg' : 'text-xl';
  const alignClass = align === 'start' ? 'justify-start' : 'justify-center';

  return (
    <div className="space-y-4">
      {title && (
        <h2 className={`${titleSize} font-semibold ${align === 'center' ? 'text-center' : ''}`}>
          {title}
        </h2>
      )}
      <div className={`flex flex-col sm:flex-row items-${align} ${alignClass} gap-3`}>
        {walletIcon && (
          <img
            src={walletIcon}
            alt={walletName}
            className="w-5 h-5 rounded object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <span className={`${size === 'sm' ? 'text-sm' : ''} font-medium`}>
          {walletName}
        </span>
        <ConnectButton.Custom>
          {({ account, openAccountModal, openChainModal }) => (
            <>
              <Button
                variant="outline"
                size="default"
                className={`${buttonHeight} px-4`}
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
                size="default"
                className={`${buttonHeight} ${size === 'sm' ? 'w-[36px]' : 'w-[44px]'} p-0`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (openAccountModal) {
                    openAccountModal();
                  }
                }}
              >
                <Lock className={iconSize} />
              </Button>
            </>
          )}
        </ConnectButton.Custom>
      </div>
    </div>
  );
}
