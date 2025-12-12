'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance, useChainId, useSwitchChain, useDisconnect } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { formatEther, parseGwei } from 'viem';

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
  Home,
  Loader2,
  MessageCircle,
  Send,
  Mail,
  AlertCircle,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  WalletInfo, 
  RPCTestModal 
} from '@/components/network-checker';
import { useNetworkInstallation } from '@/hooks/use-network-installation';
import { useRPCTest } from '@/hooks/use-rpc-test';
import { CONTRACT_ABI, CONTRACT_ADDRESS, MINT_PRICE } from '@/lib/contract-config';
import { NETWORK_CONFIG, FAST_PROTOCOL_NETWORK } from '@/lib/network-config';
import { getProviderForConnector } from '@/lib/wallet-provider';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getWalletName } from '@/lib/wallet-provider';
import { useWalletInfo } from '@/hooks/use-wallet-info';
import { BrowserWalletSteps } from '@/components/network-checker/browser-wallet-steps';
import { METAMASK_VIDEO_URL, RABBY_VIDEO_URL } from '@/lib/constants';

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
    description: 'Configure Fast RPC',
    icon: Network,
  },
];

const OnboardingPage = () => {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { isConnected, address, connector } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const networkInstallation = useNetworkInstallation();
  const rpcTest = useRPCTest();
  const { data: balance } = useBalance({ address });
  const { writeContract, data: hash, isPending: isWriting, isError: isWriteError, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed, isError: isConfirmError, error: confirmError } = useWaitForTransactionReceipt({ hash });
  
  // Start with default state, load from localStorage after mount
  const [steps, setSteps] = useState<Step[]>(() => 
    baseSteps.map(step => ({ ...step, completed: false }))
  );

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showMetaMaskModal, setShowMetaMaskModal] = useState(false);
  const [showAddRpcModal, setShowAddRpcModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [rpcAddCompleted, setRpcAddCompleted] = useState(false);
  const [rpcTestCompleted, setRpcTestCompleted] = useState(false);
  const [rpcRequired, setRpcRequired] = useState(false);
  const hasLoadedFromStorage = useRef(false);
  const hasPromptedNetworkInstall = useRef(false);
  
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected);

  // Network Details Component for the modal
  const NetworkDetailsTab = () => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const networkDetails = [
      { label: 'Network Name', value: FAST_PROTOCOL_NETWORK.chainName, field: 'name' },
      { label: 'RPC URL', value: FAST_PROTOCOL_NETWORK.rpcUrls[0], field: 'rpc' },
      { label: 'Chain ID', value: FAST_PROTOCOL_NETWORK.chainId.toString(), field: 'chainId' },
      { label: 'Currency Symbol', value: FAST_PROTOCOL_NETWORK.nativeCurrency.symbol, field: 'symbol' },
      { label: 'Block Explorer', value: FAST_PROTOCOL_NETWORK.blockExplorerUrls[0], field: 'explorer' },
    ];

    const copyToClipboard = async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <div className="space-y-2">
        <h3 className="font-semibold text-sm mb-2">Network Details</h3>
        {networkDetails.map((detail) => (
          <div
            key={detail.field}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">{detail.label}</p>
              <p className="text-xs font-mono break-all">{detail.value}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-7 w-7 p-0"
              onClick={() => copyToClipboard(detail.value, detail.field)}
            >
              {copiedField === detail.field ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  // Check if user is using MetaMask
  const isMetaMask = () => {
    if (!connector) return false;
    const connectorId = connector.id?.toLowerCase() || '';
    return (
      connectorId.includes('metamask') ||
      connectorId === 'io.metamask' ||
      connectorId === 'io.metamask.snap' ||
      (connector as any).provider?.isMetaMask === true
    );
  };

  // Helper function to load steps from localStorage
  const loadStepsFromStorage = () => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const saved = stored ? JSON.parse(stored) : {};
      setSteps((prevSteps) => {
        return baseSteps.map(step => {
          // For social steps, load from localStorage
          if (SOCIAL_STEP_IDS.includes(step.id as typeof SOCIAL_STEP_IDS[number])) {
            return { ...step, completed: saved[step.id] === true };
          }
          // For wallet step, preserve current state if connected, otherwise use saved or false
          if (step.id === 'wallet') {
            return { ...step, completed: isConnected || (saved[step.id] === true) };
          }
          // For RPC step, preserve current state
          if (step.id === 'rpc') {
            const currentRpcStep = prevSteps.find(s => s.id === 'rpc');
            return { ...step, completed: currentRpcStep?.completed || false };
          }
          return { ...step, completed: false };
        });
      });
    } catch (error) {
      console.error('Error loading onboarding steps:', error);
    }
  };

  // Initialize: disconnect wallet and load steps from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      disconnect();
      if (connector) {
        connector.disconnect?.();
      }
    }, 200);
    
    loadStepsFromStorage();
    hasLoadedFromStorage.current = true;
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for wallet disconnection and localStorage changes
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;

    if (!isConnected) {
      loadStepsFromStorage();
    }
  }, [isConnected]);

  // Listen for localStorage changes (when cleared externally, e.g., from Providers component)
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;

    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === ONBOARDING_STORAGE_KEY || e.key === 'completedTasks') && !isConnected) {
        if (e.newValue === null || e.key === ONBOARDING_STORAGE_KEY) {
          loadStepsFromStorage();
        }
      }
    };

    const handleFocus = () => {
      if (!isConnected && !localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
        loadStepsFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected]);

  const updateStepStatus = (stepId: string, completed: boolean) => {
    setSteps((prev) => {
      const updated = prev.map((step) => 
        step.id === stepId ? { ...step, completed } : step
      );
      
      // Save social steps to localStorage
      if (SOCIAL_STEP_IDS.includes(stepId as typeof SOCIAL_STEP_IDS[number])) {
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


  // Track if we've prompted Add Fast RPC after wallet connection
  const hasPromptedAddRpc = useRef(false);

  // Update wallet step status when connection changes
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const walletStep = steps.find(s => s.id === 'wallet');
    
    if (isConnected && !walletStep?.completed) {
      updateStepStatus('wallet', true);
      setRpcRequired(false); // Reset when wallet reconnects
    } else if (!isConnected && walletStep?.completed) {
      updateStepStatus('wallet', false);
      hasPromptedAddRpc.current = false;
      setRpcRequired(false); // Reset when disconnected
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Prompt Add Fast RPC after wallet step is marked complete
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const walletStep = steps.find(s => s.id === 'wallet');
    
    // Wait until wallet step is completed and we haven't prompted yet
    if (!walletStep?.completed || !isConnected || !connector || hasPromptedAddRpc.current) {
      return;
    }

    // Wait a moment after step is marked complete, then prompt
    const timer = setTimeout(async () => {
      if (!connector) return;
      
      hasPromptedAddRpc.current = true;
      
      try {
        // Use robust utility function to get the correct provider
        const provider = await getProviderForConnector(connector);
        if (!provider) {
          return;
        }

        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [NETWORK_CONFIG],
        });
        // Only show toast for MetaMask on step 5
        if (isMetaMask()) {
          toast.success('Network added successfully', {
            description: 'Fast Protocol network has been added to your wallet.',
          });
        }
        setRpcRequired(false);
      } catch (error: any) {
        // Handle user rejection - mark step 5 as incomplete and show warning
        if (error?.code === 4001) {
          // User rejected - mark step 5 as incomplete and show warning
          const walletStep = steps.find(s => s.id === 'wallet');
          if (walletStep?.completed) {
            updateStepStatus('wallet', false);
            setRpcRequired(true);
          }
          return;
        }
        
        const errorMessage = error?.message?.toLowerCase() || '';
        const isNetworkExistsError = 
          errorMessage.includes('already') ||
          errorMessage.includes('exists') ||
          errorMessage.includes('duplicate');
        
        if (isNetworkExistsError) {
          // Network already added - that's fine
          return;
        }
        
        // Log other errors but don't show toast since popup appeared
        console.error('Network addition result:', error);
      }
    }, 1500); // Wait 1.5 seconds after step is marked complete
    
    return () => clearTimeout(timer);
  }, [steps, isConnected, connector]);

  // Update Ethereum network after wallet step is marked as successful
  useEffect(() => {
    const walletStep = steps.find(s => s.id === 'wallet');
    if (!walletStep?.completed || !isConnected || !connector) {
      hasPromptedNetworkInstall.current = false;
      return;
    }

    // Wait for chainId to be available
    if (chainId === undefined) {
      const timer = setTimeout(() => {
        // Will re-run when chainId is available
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (chainId !== mainnet.id) {
      // Not on mainnet - prompt to switch
      hasPromptedNetworkInstall.current = false;
      if (switchChain) {
        try {
          switchChain({ chainId: mainnet.id });
          toast.info('Switching to Ethereum Mainnet...', {
            description: 'Please approve the network switch in your wallet.',
          });
        } catch (error: any) {
          if (error?.code !== 4001) {
            toast.error('Failed to switch network', {
              description: 'Please manually switch to Ethereum Mainnet in your wallet to continue.',
            });
          }
        }
      }
      return;
    }

    // On mainnet - skip the old network installation since we now use the new wagmi-based approach
    // The new approach is handled in the useEffect above that prompts after wallet step completion
    // Disable the old automatic installation to avoid conflicts and error toasts
  }, [steps, isConnected, chainId, switchChain, connector, networkInstallation]);




  // Update RPC step status when both Add and Test are completed
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const rpcStep = steps.find(s => s.id === 'rpc');
    if (!isConnected && rpcStep?.completed) {
      updateStepStatus('rpc', false);
      setRpcAddCompleted(false);
      setRpcTestCompleted(false);
    } else if (!rpcStep?.completed && rpcAddCompleted && rpcTestCompleted) {
      // Mark complete when both Add and Test are completed
      updateStepStatus('rpc', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcAddCompleted, rpcTestCompleted, isConnected]);
  
  // Also mark test as complete when test is successful
  useEffect(() => {
    if (rpcTest.testResult?.success === true) {
      setRpcTestCompleted(true);
    }
  }, [rpcTest.testResult?.success]);

  const handleStepAction = (stepId: string) => {
    const actions: Record<string, () => void> = {
      follow: () => {
        window.open('https://twitter.com/intent/follow?screen_name=fast_protocol', '_blank');
        toast.success('Please follow @fast_protocol to continue');
        setTimeout(() => updateStepStatus(stepId, true), 2000);
      },
      discord: () => {
        window.open('https://discord.gg/fastprotocol', '_blank');
        toast.success('Opening Discord...');
        setTimeout(() => updateStepStatus(stepId, true), 1000);
      },
      telegram: () => {
        window.open('https://t.me/Fast_Protocol', '_blank');
        toast.success('Opening Telegram...');
        setTimeout(() => updateStepStatus(stepId, true), 1000);
      },
      email: () => setShowEmailDialog(true),
      wallet: () => {
        if (openConnectModal) {
          openConnectModal();
        } else {
          toast.error('Unable to open wallet connection modal');
        }
      },
      rpc: () => {
        if (!isConnected) {
          toast.error('Please connect your wallet first');
          return;
        }
        // For MetaMask, show toggle network modal
        if (isMetaMask()) {
          setShowMetaMaskModal(true);
        } else {
          // For non-MetaMask, show Add RPC modal
          setShowAddRpcModal(true);
        }
      },
    };

    actions[stepId]?.();
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
    if (!rpcAddCompleted) {
      const actionText = isMetaMask() ? 'Toggle' : 'Add';
      toast.error(`Complete the ${actionText} step first`);
      return;
    }
    setIsTestModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsTestModalOpen(false);
    // Mark test as complete when skipping or if test was successful
    if (rpcTest.testResult?.success) {
      setRpcTestCompleted(true);
    } else {
      // Also mark as complete when user skips
      setRpcTestCompleted(true);
    }
    rpcTest.reset();
  };

  const allStepsCompleted = steps.every((step) => step.completed);

  // Minting state
  const [isMinting, setIsMinting] = useState(false);

  // Helper function to parse tokenId from transaction receipt logs
  const parseTokenIdFromReceipt = (receipt: { logs?: Array<{ address?: string; topics?: readonly string[] }> }): bigint | null => {
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
        } catch {
          return null;
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

    try {
      setIsMinting(true);

      // Check balance
      if (balance) {
        const estimatedGas = BigInt(100000);
        const totalNeeded = MINT_PRICE + estimatedGas;
        
        if (balance.value < totalNeeded) {
          setIsMinting(false);
          toast.error('Insufficient funds', {
            description: `You need ${formatEther(totalNeeded)} ETH (${formatEther(MINT_PRICE)} for mint + gas), but you have ${formatEther(balance.value)} ETH.`,
          });
          return;
        }
      }

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'mint',
        value: MINT_PRICE,
        gas: BigInt(21000),                                 // or estimate if mint uses more
        maxFeePerGas: parseGwei("1"),                // adjust based on chain
        maxPriorityFeePerGas: parseGwei("0"),
      } as unknown as any);
    } catch (error: any) {
      setIsMinting(false);
      
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
      } else if (errorMessage) {
        toast.error('Transaction Failed', {
          description: errorMessage,
        });
      }
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    if (!isConfirmed || !hash || !receipt || !address) return;

    const tokenId = parseTokenIdFromReceipt(receipt);
    const tokenIdString = tokenId?.toString();
    
    if (tokenIdString) {
      try {
        localStorage.setItem('genesisSBTTokenId', tokenIdString);
      } catch (error) {
        console.error('Error saving tokenId to localStorage:', error);
      }
    }

    const completedTasks = [
      'Follow @fast_protocol',
      'Connect Wallet',
      'Fast RPC Setup',
      'Mint Genesis SBT',
    ];

    localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
    setIsMinting(false);

    toast.success('Genesis SBT minted successfully!', {
      description: tokenIdString ? `Token ID: ${tokenIdString}` : 'Your transaction has been confirmed.',
    });
    
    setTimeout(() => router.push('/dashboard'), 500);
  }, [isConfirmed, hash, receipt, address, router]);

  // Update minting state based on transaction status
  useEffect(() => {
    if (isWriting || isConfirming) {
      setIsMinting(true);
      return;
    }

    if (isWriteError || isConfirmError) {
      setIsMinting(false);
      const error = writeError || confirmError;
      const errorMessage = error?.message || '';
      
      if (isFastRpc503Error(error)) {
        toast.error('Fast RPC Internal Error', {
          description: 'Fast RPC service returned error 503 (temporarily unavailable). Please try again in a moment.',
        });
      } else if (errorMessage.includes('User rejected') || errorMessage.includes('rejected') || errorMessage.includes('4001')) {
        toast.error('Transaction Rejected', {
          description: 'You cancelled the transaction.',
        });
      } else if (errorMessage) {
        toast.error('Transaction Failed', {
          description: errorMessage,
        });
      }
    }
  }, [isWriting, isConfirming, isWriteError, isConfirmError, writeError, confirmError]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm">
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
                const isWalletStepWithWarning = step.id === 'wallet' && rpcRequired;
                
                return (
                  <Card
                    key={step.id}
                    className={`p-4 ${
                      step.completed
                        ? 'bg-primary/5 border-primary/50'
                        : isWalletStepWithWarning
                        ? 'bg-yellow-500/10 border-yellow-500/50'
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          step.completed
                            ? 'bg-primary text-primary-foreground'
                            : isWalletStepWithWarning
                            ? 'bg-yellow-500/20 text-yellow-600'
                            : 'bg-background'
                        }`}
                      >
                        {step.completed ? (
                          <Check className="w-5 h-5" />
                        ) : isWalletStepWithWarning ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-semibold">
                            {isWalletStepWithWarning ? 'Required step' : `Step ${index + 1}`}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isWalletStepWithWarning 
                            ? 'You must add Fast RPC to your wallet to continue'
                            : step.description}
                        </p>

                      </div>

                      {step.id === 'rpc' && isConnected ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="default"
                            className="flex-shrink-0 w-28"
                            onClick={() => {
                              if (isMetaMask()) {
                                setShowMetaMaskModal(true);
                              } else {
                                setShowAddRpcModal(true);
                              }
                            }}
                            disabled={!steps.find(s => s.id === 'wallet')?.completed || rpcRequired}
                          >
                            {rpcAddCompleted && <Check className="w-4 h-4 mr-1" />}
                            {isMetaMask() ? 'Toggle' : 'Add'}
                          </Button>
                          <Button
                            variant="outline"
                            size="default"
                            className="flex-shrink-0 w-28"
                            onClick={handleTestClick}
                            disabled={!steps.find(s => s.id === 'wallet')?.completed || rpcRequired || rpcTest.isTesting}
                          >
                            {rpcTestCompleted && <Check className="w-4 h-4 mr-1" />}
                            {rpcTest.isTesting ? 'Testing...' : 'Test'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={async () => {
                            if (step.id === 'wallet' && step.completed && !rpcRequired) {
                              // Disconnect wallet when step 5 is completed
                              disconnect();
                            } else if (step.id === 'wallet' && rpcRequired) {
                              // Add RPC when required
                              if (!connector) {
                                toast.error('Wallet not connected', {
                                  description: 'Please connect your wallet first.',
                                });
                                return;
                              }
                              
                              try {
                                // Use robust utility function to get the correct provider
                                const provider = await getProviderForConnector(connector);
                                if (!provider) {
                                  toast.error('Provider not available', {
                                    description: 'Unable to access wallet provider.',
                                  });
                                  return;
                                }
                                
                                await provider.request({
                                  method: 'wallet_addEthereumChain',
                                  params: [NETWORK_CONFIG],
                                });
                                // Only show toast for MetaMask on step 5
                                if (isMetaMask()) {
                                  toast.success('Network added successfully', {
                                    description: 'Fast Protocol network has been added to your wallet.',
                                  });
                                }
                                setRpcRequired(false);
                                updateStepStatus('wallet', true);
                              } catch (error: any) {
                                if (error?.code === 4001) {
                                  // User rejected - keep warning state
                                  return;
                                }
                                toast.error('Failed to add network', {
                                  description: error?.message || 'Failed to add Fast Protocol network.',
                                });
                              }
                            } else {
                              handleStepAction(step.id);
                            }
                          }}
                          variant="outline"
                          size="default"
                          className="flex-shrink-0 w-28"
                          disabled={step.completed && step.id !== 'rpc' && step.id !== 'wallet'}
                        >
                          {step.id === 'follow' && (step.completed ? 'Following' : 'Follow')}
                          {step.id === 'discord' && (step.completed ? 'Joined' : 'Join')}
                          {step.id === 'telegram' && (step.completed ? 'Joined' : 'Join')}
                          {step.id === 'email' && (step.completed ? 'Submitted' : 'Submit')}
                          {step.id === 'wallet' && (rpcRequired ? 'Add RPC' : step.completed ? 'Disconnect' : 'Connect')}
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

      <RPCTestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={() => {
          // Test completion is handled in handleCloseModal
        }}
        onClose={handleCloseModal}
      />

      {/* MetaMask Toggle Network Modal */}
      <Dialog open={showMetaMaskModal} onOpenChange={setShowMetaMaskModal}>
        <DialogContent className="sm:max-w-md border-primary/50">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              Toggle Network
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Switch to Fast Protocol network in MetaMask
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex justify-center mb-4">
              <Image
                src="/assets/Toggle-Metamask.gif"
                alt="Toggle MetaMask Network"
                width={300}
                height={200}
                className="rounded-lg"
                unoptimized
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setRpcAddCompleted(true);
                setShowMetaMaskModal(false);
              }}
            >
              <Check className="w-4 h-4 mr-2" />
              Mark as Completed
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add RPC Modal for Non-MetaMask Wallets */}
      <Dialog open={showAddRpcModal} onOpenChange={setShowAddRpcModal}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-2xl border-primary/50 max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 rounded-none sm:rounded-lg left-0 top-0 sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-center text-xl sm:text-2xl flex items-center justify-center gap-2">
              {walletIcon && (
                <img
                  src={walletIcon}
                  alt={walletName}
                  className="w-8 h-8 rounded object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              Add RPC to {walletName}
            </DialogTitle>
            <DialogDescription className="text-center text-sm sm:text-base pt-2">
              Follow these steps to configure your wallet with Fast Protocol RPC
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0 pt-4">
              <Tabs defaultValue="network" className="w-full h-full flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                  <TabsTrigger value="network">Network Details</TabsTrigger>
                  <TabsTrigger value="video">Toggle Video</TabsTrigger>
                </TabsList>
                <TabsContent value="network" className="mt-4 flex-1 min-h-0 overflow-y-auto">
                  <NetworkDetailsTab />
                </TabsContent>
                <TabsContent value="video" className="mt-4 flex-1 min-h-0 overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full max-w-full max-h-full rounded-lg overflow-hidden flex justify-center items-center p-2">
                    <Image
                      src={isMetaMask() ? '/assets/Toggle-Metamask.gif' : '/assets/Rabby-Setup.gif'}
                      alt={isMetaMask() ? 'Toggle MetaMask Network' : 'Rabby Setup'}
                      width={800}
                      height={600}
                      className="rounded-lg object-contain w-auto h-auto"
                      style={{ maxHeight: '100%', maxWidth: '100%' }}
                      unoptimized
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
              <Button
                className="w-full"
                onClick={() => {
                  setRpcAddCompleted(true);
                  setShowAddRpcModal(false);
                }}
              >
                <Check className="w-4 h-4 mr-2" />
                Mark as Completed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  updateStepStatus('email', true);
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
