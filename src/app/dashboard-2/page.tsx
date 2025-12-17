'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Users,
  Mail,
  ChevronRight,
  Settings,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    logo: 'https://assets.coingecko.com/coins/images/11683/large/Balancer.png',
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
  const { isConnected, address, status, connector } = useAccount();
  const { openAccountModal } = useAccountModal();
  const { openConnectModal } = useConnectModal();
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected);

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
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false);
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false);
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('genesis');

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

  useEffect(() => setIsMounted(true), []);

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
    <div className="h-screen w-full bg-background relative overflow-y-auto flex flex-col">

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
      <div className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 mb-4">
        <div className="container mx-auto px-4 py-2.5 lg:py-2 text-center">
          {hasGenesisSBT ? (
            <p className="text-primary-foreground font-semibold text-sm lg:text-sm">
              🎉 You're all set for the points program kickoff! In the meantime, make your first Fast swap on these top DeFi protocols.
            </p>
          ) : (
            <p className="text-primary-foreground font-semibold text-sm lg:text-sm">
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

      <div className="flex-1 w-full flex items-center justify-center">
      <main className="container mx-auto px-4">
          <div
            className="
              grid
              gap-6 sm:gap-8 lg:gap-4
              lg:[grid-template-columns:minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]
            "
          >
            {/* ================= NFT CARD ================= */}
            <Card className="lg:row-span-4 p-5 sm:p-6 lg:p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 flex flex-col h-fit">
              <div className="space-y-3 sm:space-y-4 lg:space-y-2.5 flex flex-col">
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

                {/* NFT Visual */}
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

            <Card className="lg:col-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 border-primary/30">
              <div className="flex items-center justify-center text-center h-full">
                <div className="flex items-center flex-1 justify-center gap-2">
                  <div className="text-primary w-7 h-7 flex items-center justify-center">
                    <Award className="w-full h-full" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-base">Points</div>
                    <div className="text-xs text-muted-foreground">Earn tasks</div>
                  </div>
                </div>

                <Separator orientation="vertical" className="h-9 mx-1" />

                <div className="flex items-center flex-1 justify-center gap-2">
                  <div className="text-primary w-7 h-7 flex items-center justify-center">
                    <TrendingUp className="w-full h-full" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-base">Activity</div>
                    <div className="text-xs text-muted-foreground">Weekly bonus</div>
                  </div>
                </div>

                <Separator orientation="vertical" className="h-9 mx-1" />

                <div className="flex items-center flex-1 justify-center gap-2">
                  <div className="text-primary w-7 h-7 flex items-center justify-center">
                    <Users className="w-full h-full" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-base">Referrals</div>
                    <div className="text-xs text-muted-foreground">Invite earn</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ================= TRANSACTIONS ================= */}
            <Card className="lg:row-span-1 p-5 sm:p-6 lg:p-3.5 bg-card/50 border-border/50 flex flex-col">
              <div className="flex items-center gap-2 mb-3 sm:mb-4 lg:mb-2.5">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-3.5 lg:h-3.5 text-primary" />
                <h3 className="text-lg sm:text-xl lg:text-sm font-semibold">
                  Weekly Fast RPC Transactions
                </h3>
              </div>
              <div className="space-y-3 sm:space-y-4 lg:space-y-2.5 blur-sm">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm lg:text-sm">
                    <span className="text-muted-foreground">
                      Progress to 100 txs
                    </span>
                    <span className="font-semibold">17 / 100</span>
                  </div>
                  <Progress value={17} className="h-2 sm:h-3 lg:h-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-2.5 pt-3 sm:pt-4 lg:pt-2.5 border-t border-border/50">
                  <div className="text-center">
                    <div className="text-xs sm:text-sm lg:text-sm text-muted-foreground">
                      1 tx
                    </div>
                    <div className="font-semibold text-primary text-xs lg:text-sm">+1</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm lg:text-sm text-muted-foreground">
                      10 txs
                    </div>
                    <div className="font-semibold text-primary text-xs lg:text-sm">
                      +10
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm lg:text-sm text-muted-foreground">
                      100 txs
                    </div>
                    <div className="font-semibold text-primary text-xs lg:text-sm">
                      +100
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm lg:text-sm text-muted-foreground">
                      1000 txs
                    </div>
                    <div className="font-semibold text-primary text-xs lg:text-sm">
                      +500
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ================= DEFI PROTOCOLS ================= */}
            <Card className="lg:row-span-3 p-5 sm:p-6 lg:p-4 bg-card/50 border-border/50 flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4 sm:mb-5 lg:mb-3">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 text-primary" />
                <h3 className="text-lg sm:text-xl lg:text-base font-semibold">
                  Swap and earn rewards
                </h3>
              </div>

              {/* Scroll / Center Container */}
              <div className="flex-1 overflow-y-auto">
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
                        <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 lg:w-10 lg:h-10 rounded-lg bg-background border border-border/50 flex-shrink-0">
                          <div className="relative w-8 h-8 sm:w-10 sm:h-10 lg:w-8 lg:h-8">
                            <Image
                              src={protocol.logo}
                              alt={protocol.name}
                              fill
                              className="object-contain rounded"
                            />
                          </div>
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
              </div>
            </Card>


         

            {/* ================= REFERRALS ================= */}
            <Card className="lg:row-span-2 p-5 sm:p-6 lg:p-3.5 bg-card/50 border-border/50 flex flex-col">
              <div className="space-y-3 sm:space-y-4 lg:space-y-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-3.5 lg:h-3.5 text-primary" />
                  <h3 className="text-lg sm:text-xl lg:text-sm font-semibold">Referrals</h3>
                </div>
                <div className="blur-sm">
                  <p className="text-sm lg:text-sm text-muted-foreground">
                    Earn +1 point per successful referral (max 100/week)
                  </p>
                  <div className="bg-secondary/50 rounded-lg p-2.5 sm:p-3 lg:p-2 flex items-center justify-between mt-2">
                    <code className="text-xs lg:text-[10px]">{referralCode}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyReferralLink}
                      className="lg:h-8 lg:w-8 lg:p-0"
                    >
                      <Copy className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-xs sm:text-sm lg:text-sm">
                      <span className="text-muted-foreground">
                        This week
                      </span>
                      <span className="font-semibold">3 / 100</span>
                    </div>
                    <Progress value={3} className="h-2 lg:h-1.5" />
                  </div>
                </div>
              </div>
            </Card>
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
