'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, DollarSign } from 'lucide-react';

interface WeeklyActivitySectionProps {
  transactions?: number;
  volume?: number;
}

export const WeeklyActivitySection = ({
  transactions = 0,
  volume = 0,
}: WeeklyActivitySectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">
          Weekly Activity
        </h2>
        <p className="text-muted-foreground">
          Track your weekly transactions and volume to earn bonus
          miles
        </p>
      </div>

      {/* Transaction Activity */}
      <Card className="p-6 bg-card/50 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">
            Weekly Fast RPC Transactions
          </h3>
        </div>
        <div className="space-y-4 blur-sm">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Progress to 100 txs
              </span>
              <span className="font-semibold">17 / 100</span>
            </div>
            <Progress value={17} className="h-3" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                1 tx
              </div>
              <div className="font-semibold text-primary">+1</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                10 txs
              </div>
              <div className="font-semibold text-primary">
                +10
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                100 txs
              </div>
              <div className="font-semibold text-primary">
                +100
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                1000 txs
              </div>
              <div className="font-semibold text-primary">
                +500
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Volume Activity */}
      <Card className="p-6 bg-card/50 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">
            Weekly Fast RPC Volume
          </h3>
        </div>
        <div className="space-y-4 blur-sm">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Progress to $10,000
              </span>
              <span className="font-semibold">
                $2,130 / $10,000
              </span>
            </div>
            <Progress value={21.3} className="h-3" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                $100
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                $1,000
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                $10,000
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
