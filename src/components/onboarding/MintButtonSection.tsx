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
          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl  overflow-hidden  relative flex-shrink-0" style={{ minHeight: '192px' }}>
            <img
              src={NFT_ASSET}
              alt={NFT_NAME}
              className="w-full h-full object-contain"
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


            <div className="pt-3 border-t border-border/50 flex flex-col justify-between min-h-[200px] sm:h-56">
            {/* Description */}
              <div className="flex-shrink-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Mint your Genesis SBT, earn Fast Points, and prove you were early to the execution UX layer that makes Ethereum feel instant.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  Your Genesis SBT unlocks access to the Fast Points ecosystem. Complete tasks, make transactions, and refer friends to earn Fast Points that carry into mainnet.
                </p>
              </div>
              {/* Mint Button */}
              <div className="flex flex-col items-center justify-center sm:items-end sm:justify-end mt-4 sm:mt-auto w-full sm:w-auto flex-shrink-0">
                <Button
                  disabled={!allStepsCompleted || isMinting || alreadyMinted}
                  onClick={onMint}
                  className="text-sm sm:text-base md:text-lg tablet:text-lg lg:text-lg px-4 sm:px-8 md:px-10 tablet:px-12 lg:px-12 py-2.5 sm:py-4 md:py-5 tablet:py-6 lg:py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed glow-border w-full sm:w-auto sm:min-w-[180px] md:min-w-[200px] tablet:min-w-[200px] lg:min-w-[200px] cursor-pointer"
                >
                  {isMinting ? (
                    <Loader2 className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 tablet:w-5 tablet:h-5 lg:w-5 lg:h-5 mr-2 animate-spin" />
                  ) : alreadyMinted ? (
                    <Check className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 tablet:w-5 tablet:h-5 lg:w-5 lg:h-5 mr-2" />
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

