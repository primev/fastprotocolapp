'use client';

import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Zap,
  Award,
  Check,
  Copy,
  TrendingUp,
  DollarSign,
  Users,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { PointsHUD } from '@/components/dashboard/PointsHUD';
import { WeeklyTasksSection } from '@/components/dashboard/WeeklyTasksSection';
import { ReferralsSection } from '@/components/dashboard/ReferralsSection';
import { PartnerQuestsSection } from '@/components/dashboard/PartnerQuestsSection';
import { OneTimeTasksSection } from '@/components/dashboard/OneTimeTasksSection';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { SBTGatingModal } from '@/components/modals/SBTGatingModal';

const DashboardContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [referralCode] = useState('FAST-GEN-ABC123');
  const [points] = useState(0); // Start with 0 points for new users
  const [activeTab, setActiveTab] = useState('genesis');
  const [hasGenesisSBT, setHasGenesisSBT] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('hasGenesisSBT');
    // Default to true so users who already minted (or first-time visitors) are not blocked by the popup
    return stored ? stored === 'true' : true;
  });
  const [showSBTGatingModal, setShowSBTGatingModal] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [completedTasks, setCompletedTasks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('completedTasks');
    return saved ? JSON.parse(saved) : [];
  });

  // Handle tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['genesis', 'points', 'leaderboard'].includes(tab)) {
      // Block access to Points and Leaderboard if no Genesis SBT
      if (!hasGenesisSBT && (tab === 'points' || tab === 'leaderboard')) {
        setShowSBTGatingModal(true);
        setActiveTab('genesis');
        return;
      }
      setActiveTab(tab);
    }
  }, [searchParams, hasGenesisSBT]);

  const handleTabChange = (value: string) => {
    // Block access to Points and Leaderboard if no Genesis SBT
    if (!hasGenesisSBT && (value === 'points' || value === 'leaderboard')) {
      setShowSBTGatingModal(true);
      return;
    }
    setActiveTab(value);
    router.push(`/dashboard?tab=${value}`);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`https://fast.xyz/claim?ref=${referralCode}`);
    toast.success('Referral link copied to clipboard!');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (email.length > 255) {
      setEmailError('Email must be less than 255 characters');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Invalid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleEmailSubmit = () => {
    if (validateEmail(emailInput)) {
      localStorage.setItem('userEmail', emailInput);
      handleTaskComplete('Enter Email');
      setShowEmailDialog(false);
      setEmailInput('');
    }
  };

  const handleTaskComplete = (taskName: string) => {
    const newCompletedTasks = [...completedTasks, taskName];
    setCompletedTasks(newCompletedTasks);
    localStorage.setItem('completedTasks', JSON.stringify(newCompletedTasks));

    // If Mint Genesis SBT is completed, unlock Points and Leaderboard
    if (taskName === 'Mint Genesis SBT') {
      setHasGenesisSBT(true);
      localStorage.setItem('hasGenesisSBT', 'true');
      toast.success('Genesis SBT minted! Points and Leaderboard unlocked!');
    } else {
      toast.success(`${taskName} completed!`);
    }
  };

  const oneTimeTasks = [
    {
      name: 'Connect X',
      points: 1,
      completed: completedTasks.includes('Connect X'),
    },
    {
      name: 'Follow @fast_protocol',
      points: 1,
      completed: completedTasks.includes('Follow @fast_protocol'),
    },
    {
      name: 'Connect Wallet',
      points: 1,
      completed: completedTasks.includes('Connect Wallet'),
    },
    {
      name: 'Mint Genesis SBT',
      points: 10,
      completed: completedTasks.includes('Mint Genesis SBT'),
    },
    {
      name: 'Fast RPC Setup',
      points: 2,
      completed: completedTasks.includes('Fast RPC Setup'),
    },
    {
      name: 'Join Discord',
      points: 1,
      completed: completedTasks.includes('Join Discord'),
      action: 'https://discord.gg/fast',
    },
    {
      name: 'Join Telegram',
      points: 1,
      completed: completedTasks.includes('Join Telegram'),
      action: 'https://t.me/fast',
    },
    {
      name: 'Enter Email',
      points: 1,
      completed: completedTasks.includes('Enter Email'),
      action: 'email',
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 bg-background/80 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => router.push('/claim')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Zap className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold gradient-text">
                FAST Protocol
              </span>
            </button>
            <div className="flex items-center gap-4">
              <Badge
                variant="outline"
                className="text-lg px-4 py-2 border-primary/50"
              >
                <Award className="w-4 h-4 mr-2 text-primary" />
                {points} Points
              </Badge>
            </div>
          </div>
        </header>

        {/* Announcement Banner */}
        <div
          className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 cursor-pointer hover:from-primary/90 hover:to-primary/70 transition-all"
          onClick={() => handleTabChange('points')}
        >
          <div className="container mx-auto px-4 py-3 text-center">
            <p className="text-primary-foreground font-semibold">
              🎉 Fast Points Season 1 is Live Now!{' '}
              <span className="underline">
                Click Here to start earning FAST Points.
              </span>
            </p>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-8"
          >
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
              <TabsTrigger value="genesis" className="text-base">
                Genesis SBT
              </TabsTrigger>
              <TabsTrigger value="points" className="text-base">
                Points
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="text-base">
                Leaderboard
              </TabsTrigger>
            </TabsList>

            {/* Genesis SBT Tab */}
            <TabsContent value="genesis">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Panel - SBT Display */}
                <div className="lg:col-span-1 space-y-6">
                  <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">Genesis SBT</h2>
                        {hasGenesisSBT ? (
                          <Badge className="bg-primary text-primary-foreground">
                            <Check className="w-3 h-3 mr-1" />
                            Minted
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-muted-foreground/50"
                          >
                            Not Minted
                          </Badge>
                        )}
                      </div>

                      {/* SBT Visual */}
                      <div className="aspect-square rounded-xl bg-gradient-to-br from-primary via-primary/50 to-primary/20 border border-primary/50 flex items-center justify-center glow-border">
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

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SBT ID</span>
                          <span className="font-mono">#0001234</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Wallet</span>
                          <span className="font-mono">0x7a...f9c2</span>
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
                      </div>

                      <div className="pt-4 border-t border-border/50">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Your Genesis SBT proves you were early to Fast
                          Protocol. Your progress will carry into the main Fast
                          ecosystem at launch.
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Referrals Card */}
                  <Card className="p-6 bg-card/50 border-border/50">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <h3 className="text-xl font-semibold">Referrals</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Earn +1 point per successful referral (max 100/week)
                      </p>
                      <div className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between">
                        <code className="text-xs">{referralCode}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={copyReferralLink}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            This week
                          </span>
                          <span className="font-semibold">3 / 100</span>
                        </div>
                        <Progress value={3} className="h-2" />
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Panel - Tasks */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">
                      Fast Points Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                      Complete tasks to earn points. Your points will carry into
                      the official Fast Point System.
                    </p>
                  </div>

                  {/* One-Time Tasks */}
                  <Card className="p-6 bg-card/50 border-border/50">
                    <h3 className="text-xl font-semibold mb-4">
                      One-Time Tasks
                    </h3>
                    <div className="space-y-3">
                      {oneTimeTasks.map((task) => (
                        <div
                          key={task.name}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            task.completed
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-background/30 border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                task.completed
                                  ? 'bg-primary'
                                  : 'bg-background border border-border'
                              }`}
                            >
                              {task.completed && (
                                <Check className="w-4 h-4 text-primary-foreground" />
                              )}
                            </div>
                            <span
                              className={
                                task.completed
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                              }
                            >
                              {task.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">
                              +{task.points}
                            </Badge>
                            {!task.completed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (task.action === 'email') {
                                    setShowEmailDialog(true);
                                  } else if (task.action) {
                                    window.open(task.action, '_blank');
                                    // Auto-complete after opening link
                                    setTimeout(
                                      () => handleTaskComplete(task.name),
                                      1000
                                    );
                                  } else {
                                    handleTaskComplete(task.name);
                                  }
                                }}
                              >
                                Complete
                                {task.action && task.action !== 'email' && (
                                  <ExternalLink className="w-3 h-3 ml-2" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Weekly Activity Section */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        Weekly Activity
                      </h2>
                      <p className="text-muted-foreground">
                        Track your weekly transactions and volume to earn bonus
                        points
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
                      <div className="space-y-4">
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
                      <div className="space-y-4">
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
                            <div className="font-semibold text-primary">+1</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">
                              $1,000
                            </div>
                            <div className="font-semibold text-primary">
                              +10
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">
                              $10,000
                            </div>
                            <div className="font-semibold text-primary">
                              +100
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Points Tab */}
            <TabsContent value="points" className="space-y-8">
              <PointsHUD
                season="Season 1"
                points={0}
                rank={0}
                referrals={0}
                volume={0}
                hasGenesisSBT={false}
                hasFastRPC={false}
              />

              <WeeklyTasksSection transactions={0} volume={0} />

              <ReferralsSection
                referralCode={referralCode}
                successfulReferrals={0}
                weeklyLimit={100}
              />

              <PartnerQuestsSection />

              <OneTimeTasksSection tasks={oneTimeTasks} />

              {/* Bottom Banner */}
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
                <p className="text-sm font-medium">
                  ⚡ Fast Points earned in Season 1 will carry into the official
                  Fast Points System.
                </p>
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <LeaderboardTable />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <SBTGatingModal
        open={showSBTGatingModal && !hasGenesisSBT}
        onClose={() => setShowSBTGatingModal(false)}
      />

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md border-primary/50">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">
              Enter Your Email
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Stay updated with Fast Protocol news and announcements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  if (emailError) setEmailError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEmailSubmit();
                  }
                }}
                className={emailError ? 'border-destructive' : ''}
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleEmailSubmit}>
                Submit Email
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailDialog(false);
                  setEmailInput('');
                  setEmailError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DashboardPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
};

export default DashboardPage;