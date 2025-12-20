'use client';

import { Button } from '@/components/ui/button';
import { Copy, PlusIcon } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { toast } from 'sonner';

interface ReferralsCardProps {
  referralLink: string;
  affiliateCode: string | null;
  isLoadingCode: boolean;
  isConnected: boolean;
  onOpenModal: () => void;
}

export const ReferralsCard = ({
  referralLink,
  affiliateCode,
  isLoadingCode,
  isConnected,
  onOpenModal,
}: ReferralsCardProps) => {
  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied to clipboard!');
  };

  const handleShareOnX = () => {
    const text = `@Fast_Protocol turns efficient swap execution into tokenized rewards.\n\nI'm using it for my trades.\n\n👇\n${referralLink}\n\n#MEV #DeFi`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-4 min-w-[320px] max-w-[420px]">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Refer Friends & Earn
          </h3>
          <p className="text-xs text-muted-foreground">
            Earn Miles when your referrals swap
          </p>
        </div>
        {/* Share on X button */}
        <button
          onClick={handleShareOnX}
          disabled={!isConnected || !referralLink}
          aria-label="Share on X"
          className="flex items-center gap-2 px-2 py-2 border border-white/30 rounded-md hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 h-auto"
        >
          <span className="text-xs text-muted-foreground font-bold">Share on</span>
          <FaXTwitter className="h-4 w-4" />
        </button>
      </div>

      {/* Referral Link Section */}
      <div className="space-y-2.5">
        {/* Link Input with Actions */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 min-w-0 border border-border/50">
            <code
              className="text-xs truncate flex-1 text-foreground"
              title={referralLink}
            >
              {referralLink || <span className="text-muted-foreground">Generating...</span>}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md flex-shrink-0 hover:bg-secondary"
              onClick={(e) => {
                e.stopPropagation();
                copyReferralLink();
              }}
              disabled={!isConnected || !referralLink}
              aria-label="Copy referral link"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Plus icon to open modal */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg flex-shrink-0 border-border"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
            disabled={!isConnected}
            aria-label={affiliateCode ? 'Update affiliate code' : 'Create affiliate code'}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
