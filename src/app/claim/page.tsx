"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, TrendingUp, Users, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

const ClaimPage = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl opacity-20" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold gradient-text">FAST Protocol</span>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Hero */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Season 1 is Live</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Fast Protocol
                <br />
                <span className="gradient-text">Genesis SBT Claim</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Mint your Genesis SBT, earn Fast Points, and prove you were early to the execution UX layer that makes Ethereum feel instant.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex justify-center items-center pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => router.push("/claim/onboarding")}
              >
                <Zap className="w-5 h-5 mr-2" />
                Start App
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 pt-16">
              <Card className="p-6 bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Genesis SBT</h3>
                  <p className="text-muted-foreground text-sm">
                    Mint your proof of early adoption. Your Genesis SBT unlocks access to the Fast Points ecosystem.
                  </p>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Earn Points</h3>
                  <p className="text-muted-foreground text-sm">
                    Complete tasks, make transactions, and refer friends to earn Fast Points that carry into mainnet.
                  </p>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Compete</h3>
                  <p className="text-muted-foreground text-sm">
                    Track your ranking on the leaderboard and compete with other early adopters for top positions.
                  </p>
                </div>
              </Card>
            </div>

            {/* Stats */}
            <div className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <p className="text-3xl font-bold font-mono text-primary">10,234</p>
                <p className="text-sm text-muted-foreground">Genesis SBTs Minted</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold font-mono text-primary">2.4M</p>
                <p className="text-sm text-muted-foreground">Total Points Earned</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold font-mono text-primary">45.2K</p>
                <p className="text-sm text-muted-foreground">Transactions</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold font-mono text-primary">$8.7M</p>
                <p className="text-sm text-muted-foreground">Total Volume</p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-20">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-semibold">Fast Protocol</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Season 1 • Genesis SBT Campaign
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ClaimPage;

