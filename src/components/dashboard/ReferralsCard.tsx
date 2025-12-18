'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, Copy, PlusIcon } from 'lucide-react';
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

  const handleShare = () => {
    const text = encodeURIComponent(
      `@Fast_Protocol turns efficient swap execution into tokenized rewards.\n\nI'm using it for my trades.\n\n👇\n${referralLink}\n\n#MEV #DeFi`
    );
    const shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <Card className="p-6 bg-card/50 border-border/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between min-h-[32px]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">Referrals</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
            disabled={!isConnected}
            style={{ 
              width: '32px', 
              height: '32px', 
              minWidth: '32px', 
              minHeight: '32px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label={affiliateCode ? 'Update affiliate code' : 'Create affiliate code'}
          >
            <PlusIcon className="h-4 w-4 flex-shrink-0" />
          </Button>
        </div>
        <div className={!isConnected ? 'blur-sm pointer-events-none' : ''}>
          <p className="text-xs text-muted-foreground">
          Earn miles from Fast RPC swap transactions via your referral link.
          </p>
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-2 justify-between my-4">
            <div className="flex-1 min-w-0">
              <code
                className="text-xs break-all block text-ellipsis whitespace-nowrap overflow-hidden"
                style={{
                  display: 'block',
                  maxWidth: '15rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={referralLink}
              >
                {referralLink || <span className="text-muted-foreground">Generating link...</span>}
              </code>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                copyReferralLink();
              }}
              disabled={!isConnected}
              aria-label="Copy referral link"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          {/* {affiliateCode && (
            <p className="text-xs text-muted-foreground mt-2 mb-4">
              Code: <span className="font-mono font-semibold">{affiliateCode}</span>
            </p>
          )} */}
          {referralLink ? (
            <Button
              onClick={handleShare}
              className="w-full bg-black hover:bg-gray-900 text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-black/20 dark:bg-white dark:hover:bg-gray-100 dark:text-black"
              disabled={!referralLink || isLoadingCode}
            >
              <FaXTwitter className="w-4 h-4 mr-2" />
              Share on X
            </Button>
          ) : (
            <div className="w-full bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">
                {isLoadingCode ? 'Generating link...' : 'Connect wallet to share'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
