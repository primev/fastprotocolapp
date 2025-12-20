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
  const isMinted = hasGenesisSBT && tokenId !== undefined;
  const hasNotMinted = address && !isMinted;

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 max-w-md mx-auto">
      <div className="space-y-3 pb-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl lg:text-base font-bold">
            {NFT_NAME}
          </h2>
          {isMinted ? (
            <Badge className="bg-primary text-primary-foreground">
              <Check className="w-3 h-3 mr-1" />
              #{String(tokenId)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-muted-foreground/50">
              Not Minted
            </Badge>
          )}
        </div>

        {/* SBT Visual */}
        <div className="w-3/4 mx-auto">
          <div className="relative inline-block w-full">
            <img
              src={NFT_ASSET}
              alt={NFT_NAME}
              className="w-full h-auto block"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLElement;
                if (placeholder) placeholder.classList.remove('hidden');
              }}
            />
            <div className="w-full h-full flex items-center justify-center hidden absolute inset-0">
              <div className="text-center space-y-2">
                <Zap className="w-16 h-16 mx-auto text-primary-foreground" />
                <div className="text-primary-foreground font-bold text-lg">
                  FAST
                </div>
                <div className="text-primary-foreground/80 text-xs">
                  Genesis
                </div>
              </div>
            </div>
            {hasNotMinted && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none rounded-lg">
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
        </div>

        {/* <div className="space-y-2 pb-0 text-sm">
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
        </div>  */}

        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {NFT_DESCRIPTION}
          </p>
        </div>
      </div>
    </Card>
  );
};
