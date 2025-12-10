'use client';

import { useState, useEffect, useRef } from 'react';
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
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/lib/contract-config';

type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
};

const ONBOARDING_STORAGE_KEY = 'onboardingSteps';

const baseSteps: Omit<Step, 'completed'>[] = [
  {
    id: 'follow',
    title: 'Follow Us on X',
    description: 'Follow @fast_protocol to continue',
    icon: Twitter,
  },
  {
    id: 'wallet',
    title: 'Connect Wallet',
    description: 'Connect your wallet to mint your SBT',
    icon: Wallet,
  },
  {
    id: 'rpc',
    title: 'Fast RPC Setup',
    description: 'Configure Fast RPC for your first Fast transaction',
    icon: Network,
  },
];

const OnboardingPage = () => {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { isConnected, address, connector } = useAccount();
  const networkInstallation = useNetworkInstallation();
  const rpcTest = useRPCTest();
  
  // Start with default state, load from localStorage after mount
  const [steps, setSteps] = useState<Step[]>(() => 
    baseSteps.map(step => ({ ...step, completed: false }))
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showRpcInfo, setShowRpcInfo] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const hasLoadedFromStorage = useRef(false);

  // Load from localStorage after mount - only for step 1 (follow)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const saved = stored ? JSON.parse(stored) : {};
      setSteps(baseSteps.map(step => ({
        ...step,
        // Only load from localStorage for step 1 (follow), others start as false
        completed: step.id === 'follow' ? (saved[step.id] === true) : false,
      })));
    } catch (error) {
      console.error('Error loading onboarding steps:', error);
    } finally {
      hasLoadedFromStorage.current = true;
    }
  }, []);

  const updateStepStatus = (stepId: string, completed: boolean) => {
    setSteps((prev) => {
      const updated = prev.map((step) => 
        step.id === stepId ? { ...step, completed } : step
      );
      
      // Save to localStorage - only for step 1 (follow)
      if (typeof window !== 'undefined' && stepId === 'follow') {
        try {
          const saved = updated.reduce((acc, step) => {
            // Only save step 1 (follow) to localStorage
            if (step.id === 'follow') {
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
  // Only mark as completed if not already saved as completed
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return; // Wait for initial load to prevent flash
    const walletStep = steps.find(s => s.id === 'wallet');
    if (isConnected && !walletStep?.completed) {
      updateStepStatus('wallet', true);
    }
  }, [isConnected]);

  // Update RPC step status when network is installed or RPC test passes
  // Only update if not already completed
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return; // Wait for initial load to prevent flash
    const rpcStep = steps.find(s => s.id === 'rpc');
    if (!rpcStep?.completed) {
      if (networkInstallation.isInstalled || (rpcTest.testResult?.success === true)) {
        updateStepStatus('rpc', true);
        if (networkInstallation.isInstalled) {
          toast.success('Fast RPC network added successfully!');
        }
      }
    }
  }, [networkInstallation.isInstalled, rpcTest.testResult?.success]);

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

  const handleTestClick = () => {
    setIsTestModalOpen(true);
  };

  const handleConfirmTest = () => {
    // The test is handled by the RPCTestModal component internally
  };

  const handleCloseModal = () => {
    setIsTestModalOpen(false);
    // Clear test result when modal closes
    rpcTest.reset();
  };

  const allStepsCompleted = steps.every((step) => step.completed);

  // Check user's balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Get mint price from contract
  const { data: mintPrice } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: '_mintPrice',
    query: {
      enabled: isConnected,
    },
  });


  // TODO: Remove this once done testing
  const hasSBT = false
  // const hasSBT = balance !== undefined && Number(balance) > 0;

  // Minting state
  const [isMinting, setIsMinting] = useState(false);

  const parseTokenIdFromReceipt = (receipt: any): bigint | null => {
    if (!receipt?.logs?.length) return null;

    const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
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
  const isFastRpc503Error = (error: any): boolean => {
    if (!error) return false;
    
    // Check for 503 in various error formats
    const errorString = JSON.stringify(error).toLowerCase();
    if (errorString.includes('503') || errorString.includes('status code 503')) {
      return true;
    }
    
    // Check error code and data structure
    if (error?.code === -32603 || error?.code === 'UNKNOWN_ERROR') {
      if (error?.data?.originalError?.message?.includes('503') || 
          error?.data?.originalError?.code === 'ERR_BAD_RESPONSE') {
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

    if (mintPrice === undefined) {
      toast.error('Unable to fetch mint price. Please try again.');
      return;
    }

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
      refetchBalance();
      
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
            <button
              onClick={() => router.push('/claim')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Zap className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold gradient-text">
                FAST Protocol
              </span>
            </button>
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
                    className={`p-6 ${
                      step.completed
                        ? 'bg-primary/5 border-primary/50'
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          step.completed
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background'
                        }`}
                      >
                        {step.completed ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Step {index + 1}
                            </span>
                          </div>
                          <h3 className="text-xl font-semibold">
                            {step.title}
                          </h3>
                          <p className="text-muted-foreground">
                            {step.description}
                          </p>
                        </div>

                        {step.id === 'rpc' && showRpcInfo && !step.completed && (
                          <div className="space-y-4 pt-4 border-t border-border/50">
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

                        {!step.completed && !(step.id === 'rpc' && showRpcInfo) && (
                          <Button
                            onClick={() => handleStepAction(step.id)}
                            variant="outline"
                          >
                            {step.id === 'follow' && 'Follow @fast_protocol'}
                            {step.id === 'wallet' && 'Connect Wallet'}
                            {step.id === 'rpc' && 'Setup Fast RPC'}
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Mint Button */}
            <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold">Ready to Mint</h3>
                <p className="text-muted-foreground">
                  Complete all steps above to mint your Fast Genesis SBT
                </p>
                      <Button
                        size="lg"
                        disabled={!allStepsCompleted || isMinting || hasSBT}
                        onClick={handleMintSbt}
                        className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed glow-border"
                      >
                        {isMinting ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-5 h-5 mr-2" />
                        )}
                        {hasSBT 
                          ? 'Already Minted' 
                          : isMinting 
                            ? 'Minting...' 
                            : 'Mint Genesis SBT'}
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
        onConfirm={handleConfirmTest}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default OnboardingPage;
