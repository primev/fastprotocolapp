
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReferralsSectionProps {
  referralLink: string;
  successfulReferrals: number;
  weeklyLimit: number;
}

export const ReferralsSection = ({
  referralLink,
  successfulReferrals,
  weeklyLimit,
}: ReferralsSectionProps) => {
  const copyReferralLink = () => {
      navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied ✓");
  };

  return (
    <Card className="p-6 bg-card/50 border-border/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">Referrals</h3>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  A successful referral = Genesis SBT minted + Fast RPC setup + at least 1 Fast RPC transaction
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {successfulReferrals} / {weeklyLimit}
            </span>{" "}
            successful referrals this week
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary rounded-lg p-3 border border-border/50">
              <code className="text-xs font-mono text-foreground break-all">
                {referralLink}
              </code>
            </div>
            <Button size="sm" variant="outline" onClick={copyReferralLink}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <Progress value={(successfulReferrals / weeklyLimit) * 100} className="h-2" />

          <div className="pt-2 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Points earned: <span className="font-mono font-semibold text-success">+{successfulReferrals}</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
