'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Loader2, Zap } from 'lucide-react';

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
  existingTokenId,
  onMint,
}: MintButtonSectionProps) => {
  return (
    <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">
          {alreadyMinted
            ? `You already have a Genesis SBT${
                existingTokenId ? ` (Token ID: ${existingTokenId})` : ''
              }`
            : 'Complete all steps above to mint your Fast Genesis SBT'}
        </p>
        <Button
          size="lg"
          disabled={!allStepsCompleted || isMinting || alreadyMinted}
          onClick={onMint}
          className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed glow-border"
        >
          {isMinting ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : alreadyMinted ? (
            <Check className="w-5 h-5 mr-2" />
          ) : (
            <Zap className="w-5 h-5 mr-2" />
          )}
          {isMinting
            ? 'Minting...'
            : alreadyMinted
              ? 'Already Minted'
              : 'Mint Genesis SBT'}
        </Button>
      </div>
    </Card>
  );
};

