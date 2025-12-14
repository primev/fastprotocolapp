'use client';

import { Button } from '@/components/ui/button';
import { Check, Loader2, Zap } from 'lucide-react';
import { NFT_ASSET, NFT_NAME } from '@/lib/contract-config';
import { Card } from '../ui/card';

interface MintButtonSectionProps {
  allStepsCompleted: boolean;
  isMinting: boolean;
  alreadyMinted: boolean;
  existingTokenId?: string;
  onMint: () => void;
}

export const MintButtonSection = ({
  allStepsCompleted,
  isMinting,
  alreadyMinted,
  onMint,
}: MintButtonSectionProps) => {

  return (
    <Card className="p-6 sm:p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
      <div className="flex flex-col items-center space-y-6">


        {/* NFT Image and Details */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full">
          {/* SBT Visual */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-gradient-to-br from-primary via-primary/50 to-primary/20 border border-primary/50 overflow-hidden glow-border relative flex-shrink-0" style={{ minHeight: '192px' }}>
            <img
              src={NFT_ASSET}
              alt={NFT_NAME}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLElement;
                if (placeholder) {
                  placeholder.classList.remove('hidden');
                }
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
          </div>

          {/* Details and Description */}
          <div className="flex-1 space-y-4 w-full sm:w-auto">


            <div className="pt-3 border-t border-border/50 flex flex-col justify-between h-48 sm:h-56">
            {/* Description */}
              <div >
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Mint your Genesis SBT, earn Fast Points, and prove you were early to the execution UX layer that makes Ethereum feel instant.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  Your Genesis SBT unlocks access to the Fast Points ecosystem. Complete tasks, make transactions, and refer friends to earn Fast Points that carry into mainnet.
                </p>
              </div>
              {/* Mint Button */}
              <div className="flex flex-col items-end mt-auto">
                <Button
                  disabled={!allStepsCompleted || isMinting || alreadyMinted}
                  onClick={onMint}
                  className="text-lg px-12 py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed glow-border min-w-[200px] cursor-pointer"
                >
                  {isMinting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : alreadyMinted ? (
                    <Check className="w-5 h-5 mr-2" />
                  ) : (
                    <></>
                  )}
                  {isMinting
                    ? 'Claiming...'
                    : alreadyMinted
                      ? 'Already Claimed'
                      : 'Claim Now'}
                </Button>
              
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

