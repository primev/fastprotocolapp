'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  Mail,
  ChevronRight,
  Settings,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { ConnectButton, useAccountModal } from '@rainbow-me/rainbowkit';
import { CONTRACT_ABI, CONTRACT_ADDRESS, NFT_NAME, NFT_DESCRIPTION, NFT_ASSET } from '@/lib/contract-config';
import { DeFiProtocolsModal } from '@/components/dashboard/DeFiProtocolsModal';
import { 
  NetworkSetupDrawer, 
  RPCTestModal 
} from '@/components/network-checker';
import { useRPCTest } from '@/hooks/use-rpc-test';

const DashboardContent = () => {
  const router = useRouter();
  const { isConnected, address, isConnecting } = useAccount();
  const { openAccountModal } = useAccountModal();
  const [referralCode] = useState('FAST-GEN-ABC123');
  const [points] = useState(0);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isDeFiModalOpen, setIsDeFiModalOpen] = useState(false);
  const [storedTokenId, setStoredTokenId] = useState<string | null>(null);
  const rpcTest = useRPCTest();
  const previousAddressRef = useRef<string | undefined>(undefined);

  // Initialize component state
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('completedTasks');
    if (saved) {
      try {
        setCompletedTasks(JSON.parse(saved));
      } catch (error) {
        console.error('Error parsing completed tasks:', error);
      }
    }
  }, []);

  // Handle wallet connection/disconnection and address changes
  useEffect(() => {
    if (!isMounted) return;

    const currentAddress = address?.toLowerCase();
    const previousAddress = previousAddressRef.current?.toLowerCase();

    if (!isConnected || !address) {
      // Clear local state on disconnect (localStorage is handled globally in Providers)
      setStoredTokenId(null);
      previousAddressRef.current = undefined;
      return;
    }

    if (previousAddress && currentAddress && previousAddress !== currentAddress) {
      // Address changed - clear localStorage and reset state to trigger new contract call
      localStorage.removeItem('genesisSBTTokenId');
      setStoredTokenId(null);
    }

    previousAddressRef.current = address;
  }, [isMounted, isConnected, address]);

  // Load stored tokenId from localStorage on mount/address change
  // Use localStorage as initial value, but always fetch from contract to verify/update
  useEffect(() => {
    if (!isMounted || !isConnected || !address) {
      if (!isConnected) {
        setStoredTokenId(null);
      }
      return;
    }

    // Check localStorage first for initial display
    const stored = localStorage.getItem('genesisSBTTokenId');
    if (stored) {
      setStoredTokenId(stored);
    } else {
      // Only set to null if not in localStorage, which will trigger fetch
      setStoredTokenId(null);
    }
  }, [isMounted, isConnected, address]);

  // Sync tokenId from localStorage across tabs/windows
  useEffect(() => {
    if (!isMounted) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'genesisSBTTokenId' && e.newValue) {
        setStoredTokenId(e.newValue);
      }
    };

    const handleFocus = () => {
      const stored = localStorage.getItem('genesisSBTTokenId');
      if (stored && stored !== storedTokenId) {
        setStoredTokenId(stored);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isMounted, storedTokenId]);

  // Check if we need to fetch tokenId from contract
  // Always fetch to verify/update the value (even if localStorage has a value)
  const shouldFetchTokenId = 
    isMounted && 
    isConnected && 
    !!address && 
    !isConnecting;

  const { data: fetchedTokenId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getTokenIdByAddress',
    args: address ? [address] : undefined,
    query: {
      enabled: shouldFetchTokenId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  });


  // Update stored tokenId when fetched from contract
  // Always use contract value when available (it's the source of truth)
  // Only update state, don't save to localStorage (localStorage is only set during minting)
  useEffect(() => {
    if (fetchedTokenId !== undefined && address) {
      const tokenIdString = fetchedTokenId.toString();
      setStoredTokenId(tokenIdString);
    }
  }, [fetchedTokenId, address]);

  const tokenId = storedTokenId && storedTokenId !== '0'
    ? BigInt(storedTokenId) 
    : (fetchedTokenId && fetchedTokenId !== BigInt(0) ? fetchedTokenId : undefined);


  const hasGenesisSBT = tokenId !== undefined && tokenId !== BigInt(0);
  const hasNotMinted = isMounted && !hasGenesisSBT;


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

    if (taskName === 'Mint Genesis SBT') {
      toast.success('Genesis SBT minted! Points and Leaderboard unlocked!');
    } else {
      toast.success(`${taskName} completed!`);
    }
  };

  const oneTimeTasks = useMemo(() => [
    {
      name: 'Connect X',
      points: 1,
      completed: isMounted && completedTasks.includes('Connect X'),
    },
    {
      name: 'Follow @fast_protocol',
      points: 1,
      completed: isMounted && completedTasks.includes('Follow @fast_protocol'),
    },
    {
      name: 'Connect Wallet',
      points: 1,
      completed: isMounted && completedTasks.includes('Connect Wallet'),
    },
    {
      name: 'Mint Genesis SBT',
      points: 10,
      completed: isMounted && completedTasks.includes('Mint Genesis SBT'),
    },
    {
      name: 'Fast RPC Setup',
      points: 2,
      completed: isMounted && completedTasks.includes('Fast RPC Setup'),
    },
    {
      name: 'Join Discord',
      points: 1,
      completed: isMounted && completedTasks.includes('Join Discord'),
      action: 'https://discord.gg/fast',
    },
    {
      name: 'Join Telegram',
      points: 1,
      completed: isMounted && completedTasks.includes('Join Telegram'),
      action: 'https://t.me/fast',
    },
    {
      name: 'Enter Email',
      points: 1,
      completed: isMounted && completedTasks.includes('Enter Email'),
      action: 'email',
    },
  ], [isMounted, completedTasks]);

  return (
    <div className="min-h-screen bg-background relative overflow-y-auto">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 bg-background/80 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="relative">
              <Image
                src="/assets/fast-icon.png"
                alt="Fast Protocol"
                width={40}
                height={40}
                className="sm:hidden"
              />
              <Image
                src="/assets/fast-protocol-logo-icon.png"
                alt="Fast Protocol"
                width={150}
                height={150}
                className="hidden sm:block"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Badge
                variant="outline"
                className="h-10 px-3 text-sm border-primary/50 flex items-center"
              >
                <Award className="w-4 h-4 mr-2 text-primary" />
                {points} Points
              </Badge>
              {/* Wallet icon button for mobile (when connected) */}
              {isConnected && (
                <Button
                  variant="outline"
                  size="icon"
                  className="sm:hidden"
                  onClick={openAccountModal}
                >
                  <Wallet className="w-4 h-4" />
                </Button>
              )}
              {/* ConnectButton - full on desktop, icon-only on mobile when not connected */}
              <div className={isConnected ? 'hidden sm:block' : ''}>
                <ConnectButton showBalance={false} accountStatus="address" />
              </div>
            </div>
          </div>
        </header>

        {/* Announcement Banner */}
        <div className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50">
          <div className="container mx-auto px-4 py-3 text-center">
            {hasGenesisSBT ? (
              <p className="text-primary-foreground font-semibold">
                🎉 You're all set for the points program kickoff! In the meantime, make your first Fast swap on these{' '}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeFiModalOpen(true);
                  }}
                  className="underline hover:text-primary-foreground transition-colors"
                >
                  top DeFi protocols
                </button>
                .
              </p>
            ) : (
              <p className="text-primary-foreground font-semibold">
                🚀 Mint your Genesis SBT to unlock the points program! Complete the onboarding steps to start earning points.{' '}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/claim/onboarding');
                  }}
                  className="underline hover:text-primary-foreground transition-colors font-bold"
                >
                  Get Started
                </button>
              </p>
            )}
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
                  <div className="grid lg:grid-cols-3 gap-8 items-stretch">
                    {/* Left Panel - SBT Display */}
                    <div className="flex">
                      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 w-full flex flex-col">
                        {/* Always show SBT info */}
                        <div className="space-y-4 flex-1 flex flex-col">
                          <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold">
                              {NFT_NAME}
                            </h2>
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
                          <div className="aspect-square rounded-xl bg-gradient-to-br from-primary via-primary/50 to-primary/20 border border-primary/50 overflow-hidden glow-border relative">
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
                            {hasNotMinted && (
                              <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none">
                                <Button
                                  variant="outline"
                                  size="lg"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.push('/claim/onboarding');
                                  }}
                                  className="bg-background/90 hover:bg-background border-primary/50 hover:border-primary hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group pointer-events-auto"
                                >
                                  Mint Genesis SBT
                                  <ChevronRight className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SBT ID</span>
                              {hasGenesisSBT ? (
                                <span className="font-mono">#{String(tokenId)}</span>
                              ) : (
                                <span className="text-muted-foreground">Not Minted</span>
                              )}
                            </div>
                            {address && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Wallet</span>
                                <span className="font-mono">
                                  {address.slice(0, 4)}...{address.slice(-4)}
                                </span>
                              </div>
                            )}
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

                          <div className="pt-4 border-t border-border/50 mt-auto">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {NFT_DESCRIPTION}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Right Side - Spans 2 columns */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Dashboard Splash Header */}
                      <Card className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 border-primary/30">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                              <Award className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h1 className="text-2xl font-bold">
                                Fast Points Dashboard
                              </h1>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Complete tasks to earn points. Your points will carry into
                                the official Fast Point System.
                              </p>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-primary/20">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" />
                              <h2 className="text-lg font-semibold">
                                Transaction Activity
                              </h2>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Track your weekly transactions and volume to earn bonus points
                            </p>
                          </div>
                        </div>
                      </Card>

                      {/* Transaction Cards - Side by Side */}
                      <div className="grid md:grid-cols-2 gap-6">
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
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
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
                            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
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

                      {/* Referrals and Test RPC Section - Side by Side */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Referrals Section */}
                        <Card className="p-6 bg-card/50 border-border/50">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-5 h-5 text-primary" />
                              <h3 className="text-xl font-semibold">Referrals</h3>
                            </div>
                            <div className="blur-sm">
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
                          </div>
                        </Card>

                        {/* Test RPC Connection Section */}
                        <Card className="p-6 bg-card/50 border-border/50">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Settings className="w-5 h-5 text-primary" />
                              <h3 className="text-xl font-semibold">Test RPC connection</h3>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-4">
                                Add Fast RPC to your wallet and test the connection to earn bonus points.
                              </p>
                              <div className="flex gap-4">
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    if (!isConnected) {
                                      toast.error('Please connect your wallet first');
                                      return;
                                    }
                                    setIsDrawerOpen(true);
                                  }}
                                >
                                  Setup
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    if (!isConnected) {
                                      toast.error('Please connect your wallet first');
                                      return;
                                    }
                                    setIsTestModalOpen(true);
                                  }}
                                >
                                  Test
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
        </main>
      </div>

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

      <NetworkSetupDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />

      <RPCTestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={() => {}}
        onClose={() => {
          setIsTestModalOpen(false);
          rpcTest.reset();
        }}
      />

      <DeFiProtocolsModal
        open={isDeFiModalOpen}
        onOpenChange={setIsDeFiModalOpen}
      />
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
