'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Check,
  Twitter,
  Wallet,
  Network,
  Zap,
  ChevronRight,
  Home,
  Loader2,
  MessageCircle,
  Send,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  WalletInfo, 
  RPCConfiguration, 
  NetworkSetupDrawer, 
  RPCTestModal 
} from '@/components/network-checker';
import { useNetworkInstallation } from '@/hooks/use-network-installation';
import { useRPCTest } from '@/hooks/use-rpc-test';
import { CONTRACT_ABI, CONTRACT_ADDRESS, MINT_PRICE } from '@/lib/contract-config';
import { captureEmailAction } from '@/actions/capture-email';
import type { CaptureEmailResult } from '@/lib/email';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
};

const ONBOARDING_STORAGE_KEY = 'onboardingSteps';
const SOCIAL_STEP_IDS = ['follow', 'discord', 'telegram', 'email'] as const;
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const baseSteps: Omit<Step, 'completed'>[] = [
  {
    id: 'follow',
    title: 'Follow Us on X',
    description: 'Follow us on X',
    icon: Twitter,
  },
  {
    id: 'discord',
    title: 'Join Discord',
    description: 'Join our community on Discord',
    icon: MessageCircle,
  },
  {
    id: 'telegram',
    title: 'Join Telegram',
    description: 'Connect with us on Telegram',
    icon: Send,
  },
  {
    id: 'email',
    title: 'Enter Email',
    description: 'Stay updated with Fast Protocol news',
    icon: Mail,
  },
  {
    id: 'wallet',
    title: 'Connect Wallet',
    description: 'Connect your wallet',
    icon: Wallet,
  },
  {
    id: 'rpc',
    title: 'Fast RPC Setup',
    description: 'Add Fast RPC to your wallet',
    icon: Network,
  },
];

const OnboardingPage = () => {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { isConnected, address } = useAccount();
  const networkInstallation = useNetworkInstallation();
  const rpcTest = useRPCTest();
  
  // Start with default state, load from localStorage after mount
  const [steps, setSteps] = useState<Step[]>(() => 
    baseSteps.map(step => ({ ...step, completed: false }))
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showRpcInfo, setShowRpcInfo] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const hasLoadedFromStorage = useRef(false);

  // Helper function to load steps from localStorage
  const loadStepsFromStorage = () => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const saved = stored ? JSON.parse(stored) : {};
      setSteps(baseSteps.map(step => ({
        ...step,
        completed: SOCIAL_STEP_IDS.includes(step.id as typeof SOCIAL_STEP_IDS[number])
          ? (saved[step.id] === true)
          : false,
      })));
    } catch (error) {
      console.error('Error loading onboarding steps:', error);
    }
  };

  // Load from localStorage after mount
  useEffect(() => {
    loadStepsFromStorage();
    hasLoadedFromStorage.current = true;
  }, []);

  // Listen for wallet disconnection and reset steps
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    if (!isConnected) {
      loadStepsFromStorage();
    }
  }, [isConnected]);

  // Listen for localStorage changes (when cleared externally, e.g., from Providers component)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ONBOARDING_STORAGE_KEY || e.key === 'completedTasks') {
        if (e.newValue === null || (e.newValue !== null && e.key === ONBOARDING_STORAGE_KEY)) {
          loadStepsFromStorage();
        }
      }
    };

    const handleFocus = () => {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!stored) {
        loadStepsFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const updateStepStatus = (stepId: string, completed: boolean) => {
    setSteps((prev) => {
      const updated = prev.map((step) => 
        step.id === stepId ? { ...step, completed } : step
      );
      
      // Save social steps to localStorage
      if (typeof window !== 'undefined' && SOCIAL_STEP_IDS.includes(stepId as typeof SOCIAL_STEP_IDS[number])) {
        try {
          const saved = updated.reduce((acc, step) => {
            if (SOCIAL_STEP_IDS.includes(step.id as typeof SOCIAL_STEP_IDS[number])) {
              acc[step.id] = step.completed;
            }
            return acc;
          }, {} as Record<string, boolean>);
          localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(saved));
        } catch (error) {
          console.error('Error saving onboarding steps:', error);
        }
      }
      
      return updated;
    });
  };


  // Update wallet step status when connection changes
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const walletStep = steps.find(s => s.id === 'wallet');
    if (isConnected && !walletStep?.completed) {
      updateStepStatus('wallet', true);
    } else if (!isConnected && walletStep?.completed) {
      updateStepStatus('wallet', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Update RPC step status when network is installed or RPC test passes
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const rpcStep = steps.find(s => s.id === 'rpc');
    if (!isConnected && rpcStep?.completed) {
      updateStepStatus('rpc', false);
    } else if (!rpcStep?.completed) {
      if (networkInstallation.isInstalled || (rpcTest.testResult?.success === true)) {
        updateStepStatus('rpc', true);
        if (networkInstallation.isInstalled) {
          toast.success('Fast RPC network added successfully!');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkInstallation.isInstalled, rpcTest.testResult?.success, isConnected]);

  const handleStepAction = (stepId: string) => {
    if (stepId === 'follow') {
      // Open follow link
      window.open(
        'https://twitter.com/intent/follow?screen_name=fast_protocol',
        '_blank'
      );
      toast.success('Please follow @fast_protocol to continue');
      setTimeout(() => {
        updateStepStatus(stepId, true);
      }, 2000);
    } else if (stepId === 'discord') {
      // Open Discord link
      window.open('https://discord.gg/fastprotocol', '_blank');
      toast.success('Opening Discord...');
      setTimeout(() => {
        updateStepStatus(stepId, true);
      }, 1000);
    } else if (stepId === 'telegram') {
      // Open Telegram link
      window.open('https://t.me/Fast_Protocol', '_blank');
      toast.success('Opening Telegram...');
      setTimeout(() => {
        updateStepStatus(stepId, true);
      }, 1000);
    } else if (stepId === 'email') {
      // Open email dialog
      setShowEmailDialog(true);
    } else if (stepId === 'wallet') {
      // Open RainbowKit connect modal
      if (openConnectModal) {
        openConnectModal();
      } else {
        toast.error('Unable to open wallet connection modal');
      }
    } else if (stepId === 'rpc') {
      if (!isConnected) {
        toast.error('Please connect your wallet first');
        return;
      }
      setShowRpcInfo(true);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoadingEmail(true);
    setEmailError('');

    try {
      const result: CaptureEmailResult = await captureEmailAction({ email: emailInput.trim() });
      if (result.alreadySubscribed) {
        toast.success("You're already subscribed!");
        updateStepStatus('email', true);
        setShowEmailDialog(false);
        setEmailInput('');
      } else {
        toast.success('Success!', {
          description: "You've been added to the waitlist",
        });
        updateStepStatus('email', true);
        setShowEmailDialog(false);
        setEmailInput('');
      }
    } catch (err: any) {
      console.error('Failed to capture email', err);
      const errorMessage = err?.message || 'We could not add your email right now. Please try again.';
      toast.error('Something went wrong', {
        description: errorMessage,
      });
      setEmailError(errorMessage);
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleTestClick = () => {
    setIsTestModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsTestModalOpen(false);
    rpcTest.reset();
  };

  const allStepsCompleted = steps.every((step) => step.completed);

  // Minting state
  const [isMinting, setIsMinting] = useState(false);

  const parseTokenIdFromReceipt = (receipt: { logs?: Array<{ address?: string; topics?: string[] }> }): bigint | null => {
    if (!receipt?.logs?.length) return null;

    const contractAddressLower = CONTRACT_ADDRESS.toLowerCase();
    
    for (const log of receipt.logs) {
      const logAddress = (log.address || '').toLowerCase();
      const topics = log.topics || [];
      
      if (
        topics[0]?.toLowerCase() === TRANSFER_EVENT_SIGNATURE.toLowerCase() &&
        logAddress === contractAddressLower &&
        topics[3]
      ) {
        try {
          return BigInt(topics[3]);
        } catch (error) {
          console.error('Error parsing tokenId:', error);
        }
      }
    }
    
    return null;
  };


  // Helper function to check for Fast RPC 503 errors
  const isFastRpc503Error = (error: unknown): boolean => {
    if (!error) return false;
    
    // Check for 503 in various error formats
    const errorString = JSON.stringify(error).toLowerCase();
    if (errorString.includes('503') || errorString.includes('status code 503')) {
      return true;
    }
    
    // Check error code and data structure
    const err = error as { code?: number | string; data?: { originalError?: { message?: string; code?: string } } };
    if (err?.code === -32603 || err?.code === 'UNKNOWN_ERROR') {
      if (err?.data?.originalError?.message?.includes('503') || 
          err?.data?.originalError?.code === 'ERR_BAD_RESPONSE') {
        return true;
      }
    }
    
    return false;
  };

  const handleMintSbt = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    const mintPrice = MINT_PRICE;

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Wallet not available. Please install a wallet extension.');
      }

      setIsMinting(true);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      let userBalance;
      try {
        userBalance = await provider.getBalance(address);
      } catch (balanceError: any) {
        if (isFastRpc503Error(balanceError)) {
          throw new Error('Fast RPC Internal Error (503): The Fast RPC service is temporarily unavailable. Please try again in a moment.');
        }
        throw balanceError;
      }
      
      const estimatedGas = BigInt(100000);
      const totalNeeded = mintPrice + estimatedGas;
      
      if (userBalance < totalNeeded) {
        throw new Error(`Insufficient funds. You need ${formatEther(totalNeeded)} ETH (${formatEther(mintPrice)} for mint + gas), but you have ${formatEther(userBalance)} ETH.`);
      }
      
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      try {
        await contract.mint.estimateGas({ value: mintPrice });
      } catch (estimateError: any) {
        if (isFastRpc503Error(estimateError)) {
          throw new Error('Fast RPC Internal Error (503): The Fast RPC service is temporarily unavailable. Please try again in a moment.');
        }
        const revertReason = estimateError?.reason || estimateError?.data?.message || estimateError?.message;
        throw new Error(`Transaction would fail: ${revertReason || 'Unknown error. Please check you have enough ETH and meet all requirements.'}`);
      }

      let txResponse;
      try {
        txResponse = await contract.mint({ value: mintPrice });
      } catch (mintError: any) {
        if (isFastRpc503Error(mintError)) {
          throw new Error('Fast RPC Internal Error (503): The Fast RPC service is temporarily unavailable. Please try again in a moment.');
        }
        throw mintError;
      }

      let receipt = null;
      let pollAttempts = 0;
      const maxPollAttempts = 30;
      const pollDelayMs = 1000;
      
      while (!receipt && pollAttempts < maxPollAttempts) {
        try {
          receipt = await provider.getTransactionReceipt(txResponse.hash);
          if (receipt) break;
        } catch (error: any) {
          if (!isFastRpc503Error(error)) {
            // Continue polling for non-503 errors
          }
        }
        
        pollAttempts++;
        if (!receipt && pollAttempts < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollDelayMs));
        }
      }
      
      if (!receipt) {
        throw new Error('Transaction receipt not found after 30 seconds of polling');
      }

      const tokenId = parseTokenIdFromReceipt(receipt);
      
      if (!tokenId) {
        throw new Error('TokenId not found in transaction receipt logs');
      }
      
      localStorage.setItem('genesisSBTTokenId', tokenId.toString());
      
      const completedTasks = [
        'Follow @fast_protocol',
        'Connect Wallet',
        'Fast RPC Setup',
        'Mint Genesis SBT',
      ];

      localStorage.setItem('completedTasks', JSON.stringify(completedTasks));

      setIsMinting(false);

      toast.success('Genesis SBT minted successfully!', {
        description: 'Your transaction has been confirmed.',
      });
      
      // Navigate to dashboard now that we have confirmed tokenId
      router.push('/dashboard?tab=genesis');
    } catch (error: any) {
      setIsMinting(false);
      console.error('❌ Mint Exception Caught:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        cause: error?.cause,
        shortMessage: error?.shortMessage,
        stack: error?.stack,
      });
      
      if (isFastRpc503Error(error)) {
        toast.error('Fast RPC Internal Error', {
          description: 'Fast RPC service returned error 503 (temporarily unavailable). Please try again in a moment.',
        });
        return;
      }
      
      const errorMessage = error?.message || '';
      if (errorMessage.includes('User rejected') || errorMessage.includes('rejected')) {
        toast.error('Transaction Rejected', {
          description: 'You cancelled the transaction.',
        });
      } else if (errorMessage.includes('Fast RPC Internal Error')) {
        // Already handled above, but show it anyway
        toast.error('Fast RPC Internal Error', {
          description: errorMessage,
        });
      } else {
        toast.error('Transaction Failed', {
          description: errorMessage || 'Please try again.',
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={150}
              height={150}
            />
            <Button
              variant="outline"
              onClick={() => router.push('/claim')}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Return to Home
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold">
                Setup Your Account
              </h1>
              <p className="text-muted-foreground text-lg">
                Complete these steps to mint your Genesis SBT
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card
                    key={step.id}
                    className={`p-4 ${
                      step.completed
                        ? 'bg-primary/5 border-primary/50'
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          step.completed
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background'
                        }`}
                      >
                        {step.completed ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-semibold">
                            Step {index + 1}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>

                        {step.id === 'rpc' && showRpcInfo && !step.completed && (
                          <div className="space-y-4 pt-4 mt-4 border-t border-border/50">
                            <WalletInfo title="Wallet Connection" size="sm" align="start" />
                            <RPCConfiguration
                              onSetupClick={() => setIsDrawerOpen(true)}
                              onTestClick={handleTestClick}
                              additionalContent={
                                <Button
                                  onClick={() => {
                                    updateStepStatus('rpc', true);
                                    setShowRpcInfo(false);
                                    toast.success('Fast RPC setup marked as completed!');
                                  }}
                                  variant="default"
                                  size="sm"
                                  className="text-sm bg-primary hover:bg-primary/90"
                                >
                                  <Check className="w-3 h-3 mr-2" />
                                  Mark as Completed
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </div>

                      {!step.completed && !(step.id === 'rpc' && showRpcInfo) && (
                        <Button
                          onClick={() => handleStepAction(step.id)}
                          variant="outline"
                          size="default"
                          className="flex-shrink-0 w-28"
                        >
                          {step.id === 'follow' && 'Follow'}
                          {step.id === 'discord' && 'Join'}
                          {step.id === 'telegram' && 'Join'}
                          {step.id === 'email' && 'Submit'}
                          {step.id === 'wallet' && 'Connect'}
                          {step.id === 'rpc' && 'Setup'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Mint Button */}
            <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Complete all steps above to mint your Fast Genesis SBT
                </p>
                      <Button
                        size="lg"
                        disabled={!allStepsCompleted || isMinting}
                        onClick={handleMintSbt}
                        className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed glow-border"
                      >
                        {isMinting ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-5 h-5 mr-2" />
                        )}
                        {isMinting ? 'Minting...' : 'Mint Genesis SBT'}
                      </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>

      <NetworkSetupDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />

      <RPCTestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={() => {}}
        onClose={handleCloseModal}
      />

      {/* Email Dialog */}
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
                disabled={isLoadingEmail}
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button 
                className="flex-1" 
                onClick={handleEmailSubmit}
                disabled={isLoadingEmail}
              >
                {isLoadingEmail ? 'Submitting...' : 'Submit Email'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailDialog(false);
                  setEmailInput('');
                  setEmailError('');
                }}
                disabled={isLoadingEmail}
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

export default OnboardingPage;
