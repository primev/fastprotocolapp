'use client';

import { useState, useEffect, Suspense, useMemo, useRef, } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  Wallet,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { PointsHUD } from '@/components/dashboard/PointsHUD';
import { WeeklyTasksSection } from '@/components/dashboard/WeeklyTasksSection';
import { ReferralsSection } from '@/components/dashboard/ReferralsSection';
import { PartnerQuestsSection } from '@/components/dashboard/PartnerQuestsSection';
import { OneTimeTasksSection, type Task } from '@/components/dashboard/OneTimeTasksSection';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { SBTGatingModal } from '@/components/modals/SBTGatingModal';
import { TransactionFeedbackModal } from '@/components/modals/TransactionFeedbackModal';


import { useAccount } from 'wagmi';
import { ConnectButton, useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { CONTRACT_ABI, CONTRACT_ADDRESS, NFT_NAME, NFT_DESCRIPTION, NFT_ASSET } from '@/lib/contract-config';
import { useReadOnlyContractCall } from '@/hooks/use-read-only-contract-call';
import { DeFiProtocolsModal } from '@/components/dashboard/DeFiProtocolsModal';
import {
  NetworkSetupDrawer,
  RPCTestModal
} from '@/components/network-checker';
import { useRPCTest } from '@/hooks/use-rpc-test';
import { Separator } from '@/components/ui/separator';
import { isMetaMaskWallet, isRabbyWallet } from '@/lib/onboarding-utils';
import { useWalletInfo } from '@/hooks/use-wallet-info';
import { MetaMaskToggleModal } from '@/components/onboarding/MetaMaskToggleModal';
import { AddRpcModal } from '@/components/onboarding/AddRpcModal';
import { BrowserWalletStepsModal } from '@/components/onboarding/BrowserWalletStepsModal';
import { NETWORK_CONFIG } from '@/lib/network-config';
import { Accordion, AccordionTrigger, AccordionItem, AccordionContent } from '@/components/ui/accordion';

interface DeFiProtocol {
  name: string;
  swapUrl: string;
  logo: string;
}

// Top DeFi swap protocols on Ethereum
const TOP_DEFI_PROTOCOLS: DeFiProtocol[] = [
  {
    name: 'Uniswap',
    swapUrl: 'https://app.uniswap.org/',
    logo: 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png',
  },
  {
    name: 'Curve',
    swapUrl: 'https://curve.fi/',
    logo: 'https://assets.coingecko.com/coins/images/12124/large/Curve.png',
  },
  {
    name: 'Balancer',
    swapUrl: 'https://balancer.fi/swap/ethereum/ETH',
    logo: 'https://cryptologos.cc/logos/balancer-bal-logo.png',
  },
  {
    name: '1inch',
    swapUrl: 'https://app.1inch.io/',
    logo: 'https://assets.coingecko.com/coins/images/13469/large/1inch-token.png',
  },
  {
    name: 'SushiSwap',
    swapUrl: 'https://www.sushi.com/swap',
    logo: 'https://assets.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png',
  },
  {
    name: 'KyberSwap',
    swapUrl: 'https://kyberswap.com/swap',
    logo: 'https://assets.coingecko.com/coins/images/14899/large/RwdVsGcw_400x400.jpg',
  },
];

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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['Enter Email'];
    const saved = localStorage.getItem('completedTasks');
    const tasks = saved ? JSON.parse(saved) : [];
    // Ensure "Enter Email" is always in completed tasks
    if (!tasks.includes('Enter Email')) {
      tasks.push('Enter Email');
      localStorage.setItem('completedTasks', JSON.stringify(tasks));
    }
    return tasks;
  });


  const { isConnected, address, status, connector } = useAccount();
  const { openAccountModal } = useAccountModal();
  const { openConnectModal } = useConnectModal();
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected);
  const [isMounted, setIsMounted] = useState(false);
  const hasProcessedMintFeedback = useRef(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false);
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false);
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false);

  // Handle tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['genesis', 'points', 'leaderboard'].includes(tab)) {
      // Block access to Points and Leaderboard if no Genesis SBT
      if (!hasGenesisSBT && (tab === 'points' || tab === 'leaderboard')) {
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

  // TokenId from query param (post-mint redirect)
  const [tokenIdFromQuery, setTokenIdFromQuery] = useState<string | null>(null);
  const [fetchedTokenId, setFetchedTokenId] = useState<bigint | undefined>(undefined);
  const hasProcessedQueryParam = useRef(false);

  const rpcTest = useRPCTest();

  // Wallet detection
  const isMetaMask = isMetaMaskWallet(connector);
  const isRabby = isRabbyWallet(connector);

  // Handler for adding network (MetaMask wallet_addEthereumChain)
  const handleAddNetwork = async () => {
    if (!isConnected || !connector) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      let provider = null;
      try {
        provider = await connector.getProvider();
      } catch (error) {
        console.error('Error getting provider from connector:', error);
      }

      // Fallback to window.ethereum
      if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        provider = Array.isArray(ethereum) ? ethereum[0] : ethereum;
      }

      if (!provider || !provider.request) {
        toast.error('Provider not available', {
          description: 'Unable to access wallet provider.',
        });
        return;
      }

      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [NETWORK_CONFIG],
      });

      toast.success('Network added successfully', {
        description: 'Fast Protocol network has been added to your wallet.',
      });
    } catch (error: any) {
      if (error?.code === 4001) {
        // User rejected
        return;
      }
      toast.error('Failed to add network', {
        description: error?.message || 'Failed to add Fast Protocol network.',
      });
    }
  };

  // Handler for RPC setup based on wallet type
  const handleRpcSetup = () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (isMetaMask) {
      setIsMetaMaskModalOpen(true);
    } else if (isRabby) {
      setIsAddRpcModalOpen(true);
    } else {
      setIsBrowserWalletModalOpen(true);
    }
  };

  useEffect(() => {setIsMounted(true);
    // setShowFeedbackModal(true);
  }, []);

  // Memoize args to prevent unnecessary refetches
  const contractArgs = useMemo(() => (address ? [address] : []), [address]);

  // Use the read-only contract call hook
  const {
    data: contractTokenId,
    isLoading: isLoadingTokenId,
    error: tokenIdError,
  } = useReadOnlyContractCall<bigint>({
    contractAddress: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTokenIdByAddress',
    args: contractArgs,
    enabled: isConnected && !!address,
  });

  // Handle query params and process contract result
  useEffect(() => {
    if (!isConnected || !address) {
      setFetchedTokenId(undefined);
      setTokenIdFromQuery(null); // Clear query tokenId when disconnected
      return;
    }

    // Handle tokenId from query params (post-mint redirect)
    const tokenIdParam = searchParams.get('tokenId');
    if (tokenIdParam && !hasProcessedQueryParam.current) {
      setTokenIdFromQuery(tokenIdParam);
      localStorage.setItem('genesisSBTTokenId', tokenIdParam);
      hasProcessedQueryParam.current = true;

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('tokenId');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }

    // Process contract result
    if (tokenIdError) {
      console.error('Error reading tokenId:', tokenIdError);
      setFetchedTokenId(undefined);
      return;
    }

    if (!isLoadingTokenId && contractTokenId !== null && contractTokenId !== undefined) {
      const fetchedValue = contractTokenId;
      console.log('Fetched tokenId from contract:', fetchedValue?.toString(), 'for address:', address);

      const tokenIdFromLocalStorage = localStorage.getItem('genesisSBTTokenId');

      // If contract value matches stored value, clear from localStorage.
      // This means that the contract has been updated and the user has minted the SBT.
      if (tokenIdFromLocalStorage && fetchedValue !== BigInt(0) && fetchedValue.toString() === tokenIdFromLocalStorage) {
        localStorage.removeItem('genesisSBTTokenId');
        setFetchedTokenId(fetchedValue);
      } else if (fetchedValue !== BigInt(0)) {
        // Use the value from the contract
        setFetchedTokenId(fetchedValue);
      } else {
        // No token found in contract
        setFetchedTokenId(undefined);
      }
    } else if (!isLoadingTokenId) {
      // No token found
      setFetchedTokenId(undefined);
    }
  }, [isConnected, address, contractTokenId, isLoadingTokenId, tokenIdError, searchParams, router]);

  // Determine final tokenId: query param > contract value
  // Only use tokenId if wallet is connected
  const tokenId = useMemo(() => {
    if (!isConnected || !address) return undefined;
    if (tokenIdFromQuery) return BigInt(tokenIdFromQuery);
    if (fetchedTokenId !== undefined && fetchedTokenId !== BigInt(0)) return fetchedTokenId;
    return undefined;
  }, [tokenIdFromQuery, fetchedTokenId, isConnected, address]);

  useEffect(() => {
    if (tokenId !== undefined && tokenId !== BigInt(0)) {
      setHasGenesisSBT(true);
    } else {
      setHasGenesisSBT(false);
    }
  }, [tokenId]);

  // Show feedback modal when routing from onboarding after successful mint
  useEffect(() => {
    // Check if we have a tokenId from query params (fresh mint from onboarding)
    // tokenIdFromQuery is set when the param is detected, before it's removed from URL
    if (tokenIdFromQuery && tokenId !== undefined && tokenId !== BigInt(0)) {
      // If "Mint Genesis SBT" is not in completedTasks, add it and show feedback modal
      if (!completedTasks.includes('Mint Genesis SBT') && !hasProcessedMintFeedback.current) {
        hasProcessedMintFeedback.current = true;
        const newCompletedTasks = [...completedTasks, 'Mint Genesis SBT'];
        setCompletedTasks(newCompletedTasks);
        localStorage.setItem('completedTasks', JSON.stringify(newCompletedTasks));
        localStorage.setItem('hasGenesisSBT', 'true');
        // toast.success('Genesis SBT minted! Points and Leaderboard unlocked!');
        // Show feedback modal
        setShowFeedbackModal(true);
      }
    }
  }, [tokenIdFromQuery, tokenId, completedTasks]);

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

    // If Mint Genesis SBT is completed, unlock Points and Leaderboard
    if (taskName === 'Mint Genesis SBT') {
      setHasGenesisSBT(true);
      localStorage.setItem('hasGenesisSBT', 'true');
      toast.success('Genesis SBT minted! Points and Leaderboard unlocked!');
      // Show feedback modal
      setShowFeedbackModal(true);
    } else {
      toast.success(`${taskName} completed!`);
    }
  };

  const oneTimeTasks = [
    {
      name: 'Connect Wallet',
      completed: completedTasks.includes('Connect Wallet'),
    },
    {
      name: 'Fast RPC Setup',
      completed: completedTasks.includes('Fast RPC Setup'),
    },
    {
      name: 'Mint Genesis SBT',
      completed: completedTasks.includes('Mint Genesis SBT'),
    },
    {
      name: 'Follow @fast_protocol',
      points: 1,
      completed: completedTasks.includes('Follow @fast_protocol'),
      action: 'https://x.com/fast_protocol',
    },
    {
      name: 'Join Discord',
      completed: completedTasks.includes('Join Discord'),
      action: 'https://discord.gg/fast',
    },
    {
      name: 'Join Telegram',
      completed: completedTasks.includes('Join Telegram'),
      action: 'https://t.me/fast',
    },
    {
      name: 'Enter Email',
      completed: true, // Todo --> set back to false after testing
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
          <div className="container mx-auto px-4 py-4 lg:py-2.5 flex items-center justify-between">
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
                height={75}
                className="hidden sm:block"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Badge
                variant="outline"
                className="h-10 px-3 lg:px-2.5 text-sm lg:text-sm border-primary/50 flex items-center"
              >
                <Award className="w-4 h-4 lg:w-3.5 lg:h-3.5 mr-2 lg:mr-1.5 text-primary" />
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
              {/* ConnectButton - full on desktop, "Connect" only on mobile when not connected */}
              {isConnected ? (
                <div className="hidden sm:block">
                  <ConnectButton showBalance={false} accountStatus="address" />
                </div>
              ) : (
                <>
                  {!isMounted || status === 'connecting' || status === 'reconnecting' ? (
                    <Skeleton className="h-10 w-32 rounded-full" />
                  ) : (
                    <>
                      <Button
                        onClick={openConnectModal}
                        className="h-10 sm:hidden px-4"
                      >
                        Connect
                      </Button>
                      <div className="hidden sm:block">
                        <ConnectButton showBalance={false} accountStatus="address" />
                      </div>
                    </>
                  )}
                </>
              )}
              {isConnected && (
                <div className="relative">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Account Settings"
                        className="w-10 h-10 rounded-full border border-border shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/50 transition"
                      >
                        <Settings className="w-5 h-5 text-primary" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[220px] rounded-lg shadow-lg border border-border p-2 bg-background">
                      <DropdownMenuLabel className="text-[13px] text-foreground/80 font-semibold pb-1">
                        Fast Protocol Network
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isMetaMask && (
                        <DropdownMenuItem
                          className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                          onSelect={e => {
                            e.preventDefault();
                            handleAddNetwork();
                          }}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2" />
                          Add RPC to Wallet
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                        onSelect={e => {
                          e.preventDefault();
                          handleRpcSetup();
                        }}
                      >
                        <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mr-2" />
                        {isMetaMask ? 'Toggle Network' : 'Setup RPC'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                        onSelect={e => {
                          e.preventDefault();
                          if (!isConnected) {
                            toast.error('Please connect your wallet first');
                            return;
                          }
                          setIsTestModalOpen(true);
                        }}
                      >
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                        Test RPC Connection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Announcement Banner */}
        <div
          className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 hover:from-primary/90 hover:to-primary/70 transition-all"
          // onClick={() => handleTabChange('points')}
        >
          <div className="container mx-auto px-4 py-2 text-center">
          <p className="text-primary-foreground font-semibold">
              🎉 You're all set for the points program kickoff! In the meantime, make your first Fast swap on these top DeFi protocols.
            </p>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-8"
          >
            <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3">
              <TabsTrigger value="genesis" className="text-base">
                Genesis SBT
              </TabsTrigger>
              <TabsTrigger value="points" className="text-base" disabled>
                Points
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground text-xs font-semibold border border-border">
                  Coming Soon
                </span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="text-base" disabled>
                Leaderboard
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground text-xs font-semibold border border-border">
                  Coming Soon
                </span>
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
                        <h2 className="text-xl sm:text-2xl lg:text-base font-bold">
                          {NFT_NAME}
                        </h2>
                        {hasGenesisSBT ? (
                          <Badge className="bg-primary text-primary-foreground">
                            <Check className="w-3 h-3 mr-1" />
                            Minted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted-foreground/50">
                            Not Minted
                          </Badge>
                        )}
                      </div>

                      {/* SBT Visual */}
                      <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-primary via-primary/50 to-primary/20 border border-primary/50 overflow-hidden relative">
                        <img
                          src={NFT_ASSET}
                          alt={NFT_NAME}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.classList.remove('hidden');
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
                              className="bg-background/90 hover:bg-background border-primary/50 hover:border-primary hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group pointer-events-auto lg:text-sm lg:h-10 lg:px-6"
                            >
                              Mint Genesis SBT
                              <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5 ml-2 lg:ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SBT ID</span>
                          {hasGenesisSBT ? (
                            <span className="font-mono text-xs">#{String(tokenId)}</span>
                          ) : (
                            <span className="text-muted-foreground">Not Minted</span>
                          )}
                        </div>


                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Wallet</span>
                          {address && (
                            <span className="font-mono text-xs">
                              {address.slice(0, 4)}...{address.slice(-4)}
                            </span>
                          )}
                          {!address && (
                            <span className="text-muted-foreground">Not Connected</span>
                          )}
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

                      <div className="pt-3 border-t border-border/50">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {NFT_DESCRIPTION}
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
                        Earn points when users perform a Fast RPC transaction using your referral link.
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

                  {/* One-Time Tasks Accordion - Only show if there are incomplete tasks */}
                  {oneTimeTasks.some(task => !task.completed) && (
                    <Accordion type="single" collapsible className="mb-6 bg-card/50 border border-border/50 rounded-lg overflow-hidden">
                      <AccordionItem value="one-time-tasks">
                        <AccordionTrigger className="flex justify-between items-center px-6 py-4 no-underline hover:no-underline focus:no-underline">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-semibold m-0">One-Time Tasks</h3>
                            <span className="text-sm text-muted-foreground">
                              ({oneTimeTasks.filter(task => !task.completed).length} remaining)
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-6 pb-6">
                          <div className="space-y-3">
                            {oneTimeTasks.filter(task => !task.completed).map((task) => (
                            <div
                              key={task.name}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${task.completed
                                  ? 'bg-primary/5 border-primary/30'
                                  : 'bg-background/30 border-border hover:border-primary/30'
                                }`}
                            >
                              <div className="flex items-center gap-3">
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
                                    {task.action && (
                                      <ExternalLink className="w-3 h-3 ml-2" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  )}

                  {/* Swap & Earn Accordion */}
                  <Accordion type="single" collapsible defaultValue="swap-earn" className="mb-6 bg-card/50 border border-border/50 rounded-lg overflow-hidden">
                    <AccordionItem value="swap-earn">
                      <AccordionTrigger className="flex justify-between items-center px-6 py-4 no-underline hover:no-underline focus:no-underline">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold m-0">Swap & Earn</h3>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-6 pb-6">
                        <div className="grid grid-cols-2 gap-3">
                          {TOP_DEFI_PROTOCOLS.map((protocol) => (
                            <Card
                              key={protocol.name}
                              className="p-3 sm:p-4 lg:p-3 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
                              onClick={() => {
                                if (protocol.swapUrl) {
                                  window.open(protocol.swapUrl, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            >
                              <div className="flex items-center gap-3 sm:gap-4 lg:gap-3">
                                  <div className="relative w-8 h-8 sm:w-10 sm:h-10 lg:w-8 lg:h-8">
                                    <Image
                                      src={protocol.logo}
                                      alt={protocol.name}
                                      fill
                                      className="object-contain rounded"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-semibold text-sm sm:text-base lg:text-sm group-hover:text-primary transition-colors">
                                      {protocol.name}
                                    </h4>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

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

      <RPCTestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={() => { }}
        onClose={() => {
          setIsTestModalOpen(false);
          rpcTest.reset();
        }}
      />

      {/* MetaMask Toggle Network Modal */}
      <MetaMaskToggleModal
        open={isMetaMaskModalOpen}
        onOpenChange={setIsMetaMaskModalOpen}
        onComplete={() => {
          setIsMetaMaskModalOpen(false);
        }}
      />

      {/* Add RPC Modal for Non-MetaMask Wallets */}
      <AddRpcModal
        open={isAddRpcModalOpen}
        onOpenChange={setIsAddRpcModalOpen}
        walletName={walletName}
        walletIcon={walletIcon}
        isMetaMask={isMetaMask}
        onComplete={() => {
          setIsAddRpcModalOpen(false);
        }}
      />

      {/* Browser Wallet Steps Modal */}
      <BrowserWalletStepsModal
        open={isBrowserWalletModalOpen}
        onOpenChange={setIsBrowserWalletModalOpen}
        walletName={walletName}
        walletIcon={walletIcon}
        onComplete={() => {
          setIsBrowserWalletModalOpen(false);
        }}
      />

      {/* Transaction Feedback Modal */}
      <TransactionFeedbackModal
        isOpen={showFeedbackModal}
        walletAddress={address}
        onClose={() => setShowFeedbackModal(false)}
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