'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, ChevronRight } from 'lucide-react';
import { NFT_NAME, NFT_DESCRIPTION, NFT_ASSET } from '@/lib/contract-config';

interface SBTDisplayCardProps {
  hasGenesisSBT: boolean;
  tokenId: bigint | undefined;
  address: string | undefined;
  isMounted: boolean;
}

export const SBTDisplayCard = ({
  hasGenesisSBT,
  tokenId,
  address,
  isMounted,
}: SBTDisplayCardProps) => {
  const router = useRouter();
  const hasNotMinted = isMounted && !hasGenesisSBT;

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl lg:text-base font-bold">
            {NFT_NAME}
          </h2>
          {hasGenesisSBT ? (
            <Badge className="bg-primary text-primary-foreground">
              <Check className="w-3 h-3 mr-1" />
              Minted
            </Badge>
          ) : (
            <Badge variant="outline" className="border-muted-foreground/50">
              Not Minted
            </Badge>
          )}
        </div>

        {/* SBT Visual */}
        <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-primary via-primary/50 to-primary/20 border border-primary/50 overflow-hidden relative">
          <img
            src={NFT_ASSET}
            alt={NFT_NAME}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) placeholder.classList.remove('hidden');
            }}
          />
          <div className="w-full h-full flex items-center justify-center hidden absolute inset-0">
            <div className="text-center space-y-2">
              <Zap className="w-20 h-20 mx-auto text-primary-foreground" />
              <div className="text-primary-foreground font-bold text-xl">
                FAST
              </div>
              <div className="text-primary-foreground/80 text-sm">
                Genesis
              </div>
            </div>
          </div>
          {hasNotMinted && (
            <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none">
              <Button
                variant="outline"
                size="lg"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push('/claim/onboarding');
                }}
                className="bg-background/90 hover:bg-background border-primary/50 hover:border-primary hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group pointer-events-auto lg:text-sm lg:h-10 lg:px-6"
              >
                Mint Genesis SBT
                <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5 ml-2 lg:ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">SBT ID</span>
            {hasGenesisSBT ? (
              <span className="font-mono text-xs">#{String(tokenId)}</span>
            ) : (
              <span className="text-muted-foreground">Not Minted</span>
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Wallet</span>
            {address && (
              <span className="font-mono text-xs">
                {address.slice(0, 4)}...{address.slice(-4)}
              </span>
            )}
            {!address && (
              <span className="text-muted-foreground">Not Connected</span>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant="outline"
              className="text-xs border-primary/50"
            >
              On-chain via Fast RPC
            </Badge>
          </div>
        </div>

        <div className="pt-3 border-t border-border/50">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {NFT_DESCRIPTION}
          </p>
        </div>
      </div>
    </Card>
  );
};
