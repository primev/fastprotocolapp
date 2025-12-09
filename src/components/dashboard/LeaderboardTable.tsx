"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  points: number;
  volume: number;
  transactions: number;
  referrals: number;
  isCurrentUser?: boolean;
}

const mockLeaderboardData: LeaderboardEntry[] = [
  { rank: 1, wallet: "0x742d...3f4a", points: 45230, volume: 1250000, transactions: 3420, referrals: 100 },
  { rank: 2, wallet: "vitalik.eth", points: 42180, volume: 980000, transactions: 2890, referrals: 95 },
  { rank: 3, wallet: "0x9c3b...7e21", points: 38950, volume: 875000, transactions: 2456, referrals: 88 },
  { rank: 4, wallet: "0x1f5a...4d89", points: 35420, volume: 720000, transactions: 2103, referrals: 76 },
  { rank: 5, wallet: "0x8e2c...9b34", points: 32180, volume: 650000, transactions: 1987, referrals: 71 },
  { rank: 418, wallet: "0x7a23...f9c2", points: 12430, volume: 23120, transactions: 117, referrals: 32, isCurrentUser: true },
];

export const LeaderboardTable = () => {
  const [activeTab, setActiveTab] = useState("global");

  const currentUser = mockLeaderboardData.find(entry => entry.isCurrentUser);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="font-mono text-sm text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Season 1 Leaderboard</h1>
        <p className="text-muted-foreground">
          Track your ranking and compete with other Fast Protocol users
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="referral">Referrals</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card className="p-6 bg-card/50 border-border/50">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-primary">Rank</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-primary">Wallet</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-primary">Points</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-primary">Volume</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-primary">Transactions</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-primary">Referrals</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLeaderboardData.map((entry) => (
                    <tr
                      key={entry.rank}
                      className={`border-b border-border/30 transition-colors ${
                        entry.isCurrentUser
                          ? "bg-primary/10 border-primary/50"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getRankBadge(entry.rank)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm">
                          {entry.wallet}
                          {entry.isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              You
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold">
                        {entry.points.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono">
                        ${entry.volume.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono">
                        {entry.transactions.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono">
                        {entry.referrals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {mockLeaderboardData.map((entry) => (
                <div
                  key={entry.rank}
                  className={`p-4 rounded-lg border ${
                    entry.isCurrentUser
                      ? "bg-primary/10 border-primary/50"
                      : "bg-secondary/30 border-border/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getRankBadge(entry.rank)}
                      <span className="font-mono text-sm">{entry.wallet}</span>
                    </div>
                    {entry.isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Points:</span>
                      <span className="ml-2 font-mono font-semibold">
                        {entry.points.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="ml-2 font-mono">
                        ${entry.volume.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Txs:</span>
                      <span className="ml-2 font-mono">{entry.transactions}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Refs:</span>
                      <span className="ml-2 font-mono">{entry.referrals}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Your Position Card */}
      {currentUser && (
        <Card className="p-4 bg-card/95 border-primary/50">
          <div className="flex items-center justify-between flex-wrap gap-3 text-sm">
            <span className="font-semibold text-success">Your Position</span>
            <span className="font-mono">
              Rank <span className="font-bold">#{currentUser.rank}</span>
            </span>
            <span className="font-mono">
              <span className="font-bold">{currentUser.points.toLocaleString()}</span> Points
            </span>
            <span className="font-mono">
              ${currentUser.volume.toLocaleString()} Volume
            </span>
            <span className="font-mono">
              {currentUser.transactions} Txs
            </span>
            <span className="font-mono">
              {currentUser.referrals} Refs
            </span>
          </div>
        </Card>
      )}
    </div>
  );
};