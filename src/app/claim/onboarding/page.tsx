'use client';

import { useState, useEffect } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, usePublicClient } from 'wagmi';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

import {
  Twitter,
  Wallet,
  Network,
} from 'lucide-react';
import { toast } from 'sonner';
import { RPCTestModal } from '@/components/network-checker';

// Hooks
import { useRPCTest } from '@/hooks/use-rpc-test';
import { useWalletInfo } from '@/hooks/use-wallet-info';
import { useOnboardingSteps, type BaseStep } from '@/hooks/use-onboarding-steps';
import { useRPCSetup } from '@/hooks/use-rpc-setup';
import { useWalletConnection } from '@/hooks/use-wallet-connection';
import { useMinting } from '@/hooks/use-minting';

// Utils and components
import { isMetaMaskWallet, isRabbyWallet } from '@/lib/onboarding-utils';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingStepsList } from '@/components/onboarding/OnboardingStepsList';
import { MintButtonSection } from '@/components/onboarding/MintButtonSection';
import { MetaMaskToggleModal } from '@/components/onboarding/MetaMaskToggleModal';
import { AddRpcModal } from '@/components/onboarding/AddRpcModal';
import { BrowserWalletStepsModal } from '@/components/onboarding/BrowserWalletStepsModal';

// Constants
const baseSteps: BaseStep[] = [
  {
    id: 'community',
    title: 'Follow Us on X',
    description: 'Follow us on X',
    icon: Twitter,
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
  const { openConnectModal } = useConnectModal();
  const { isConnected, address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { disconnect } = useDisconnect();
  const rpcTest = useRPCTest();
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected);

  // Custom hooks
  const {
    steps,
    updateStepStatus,
    allStepsCompleted,
    hasInitialized,
  } = useOnboardingSteps({
    baseSteps,
    isConnected,
  });

  // Check if follow step is completed on mount and mark community step as complete
  useEffect(() => {
    if (!hasInitialized) return;

    const saved = localStorage.getItem('onboardingSteps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.follow === true) {
          const communityStep = steps.find(s => s.id === 'community');
          if (communityStep && !communityStep.completed) {
            updateStepStatus('community', true);
          }
        }
      } catch (error) {
        console.error('Error checking follow step:', error);
      }
    }
  }, [hasInitialized, steps, updateStepStatus]);

  // Already configured wallet state - default to false (not configured)
  const [alreadyConfiguredWallet] = useState<boolean>(false);

  const rpcSetup = useRPCSetup({
    isConnected,
    connector,
    walletStepCompleted: steps.find((s) => s.id === 'wallet')?.completed || false,
    hasInitialized,
    updateStepStatus,
    rpcTest,
    alreadyConfiguredWallet,
  });

 


  useWalletConnection({
    isConnected,
    connector,
    walletStepCompleted: steps.find((s) => s.id === 'wallet')?.completed || false,
    hasInitialized,
    updateStepStatus,
    setRpcRequired: rpcSetup.setRpcRequired,
    rpcRequired: rpcSetup.rpcRequired,
    alreadyConfiguredWallet,
  });

  // Note: RPC step completion logic is handled in useRPCSetup hook
  // It automatically sets rpcAddCompleted and rpcTestCompleted to true when alreadyConfiguredWallet is true
  // and marks the RPC step as complete when both flags are true

  const minting = useMinting({
    isConnected,
    address,
    publicClient,
  });

  // Modal states
  const [isRPCTestModalOpen, setIsRPCTestModalOpen] = useState(false);
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false);
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false);
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false);

  // Derived values
  const walletStep = steps.find((s) => s.id === 'wallet');
  const isMetaMask = isMetaMaskWallet(connector);
  const isRabby = isRabbyWallet(connector);
  const isWalletStepWithWarning = rpcSetup.rpcRequired;


  // Event handlers
  const handleStepAction = (stepId: string) => {
    const actions: Record<string, () => void> = {
      community: () => {
        window.open('https://twitter.com/intent/follow?screen_name=fast_protocol', '_blank');
        toast.success('Please follow @fast_protocol to continue');
        setTimeout(() => {
          updateStepStatus('community', true);
          // Also save 'follow' to localStorage for consistency
          const saved = localStorage.getItem('onboardingSteps');
          const parsed = saved ? JSON.parse(saved) : {};
          parsed.follow = true;
          localStorage.setItem('onboardingSteps', JSON.stringify(parsed));
        }, 2000);
      },
      wallet: () => {
        // Directly open the connect modal
        openConnectModal();
      },
      rpc: () => {
        if (!isConnected) {
          toast.error('Please connect your wallet first');
          return;
        }
        if (isMetaMask) {
          setIsMetaMaskModalOpen(true);
        } else {
          setIsAddRpcModalOpen(true);
        }
      },
    };

    actions[stepId]?.();
  };


  const handleTestClick = () => {
    // If alreadyConfiguredWallet is true, skip the check since toggle/add is already done
    if (!alreadyConfiguredWallet && !rpcSetup.rpcAddCompleted) {
      const actionText = isMetaMask ? 'Toggle' : 'Add';
      toast.error(`Complete the ${actionText} step first`);
      return;
    }
    setIsRPCTestModalOpen(true);
  };

  const handleCloseTestModal = () => {
    setIsRPCTestModalOpen(false);
    rpcSetup.setRpcTestCompleted(true);
    rpcTest.reset();
  };


  const handleWalletStepClick = async () => {
    if (walletStep?.completed && !rpcSetup.rpcRequired) {
      disconnect();
    } else if (rpcSetup.rpcRequired) {
      await rpcSetup.handleAddRPC();
    } else {
      handleStepAction('wallet');
    }
  };

  const handleRpcStepClick = () => {
    if (isMetaMask) {
      setIsMetaMaskModalOpen(true);
    } else if (isRabby) {
      setIsAddRpcModalOpen(true);
    } else {
      setIsBrowserWalletModalOpen(true);
    }
  };

  const handleStepClick = (stepId: string) => {
    if (stepId === 'wallet') {
      handleWalletStepClick();
    } else {
      handleStepAction(stepId);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <OnboardingHeader />

        <main className="w-full px-4 lg:container lg:mx-auto xl:w-full xl:max-w-none 2xl:container 2xl:mx-auto flex-1 flex items-center justify-center">
          <div className="w-full lg:max-w-3xl xl:max-w-none 2xl:max-w-3xl mx-auto space-y-6 sm:space-y-8 lg:space-y-5">
            <OnboardingStepsList
              steps={steps}
              isWalletStepWithWarning={isWalletStepWithWarning}
              isConnected={isConnected}
              isMetaMask={isMetaMask}
              rpcAddCompleted={rpcSetup.rpcAddCompleted}
              rpcTestCompleted={rpcSetup.rpcTestCompleted}
              rpcRequired={rpcSetup.rpcRequired}
              isTesting={rpcTest.isTesting}
              walletStepCompleted={walletStep?.completed || false}
              alreadyConfiguredWallet={alreadyConfiguredWallet}
              onStepClick={handleStepClick}
              onRpcStepClick={handleRpcStepClick}
              onTestClick={handleTestClick}
            />

            <MintButtonSection
              allStepsCompleted={allStepsCompleted}
              isMinting={minting.isMinting}
              alreadyMinted={minting.alreadyMinted}
              existingTokenId={minting.existingTokenId}
              onMint={minting.handleMintSbt}
            />

            <div className="text-center space-y-1.5 sm:space-y-2 tablet:space-y-2 lg:space-y-1.5 pb-4 sm:pb-0">
              <p className="text-muted-foreground text-sm sm:text-base md:text-base tablet:text-lg lg:text-base xl:text-base">
                Complete these steps to mint your Genesis SBT
              </p>
            </div>
          </div>
        </main>

        {/* RPC Test Modal */}
        <RPCTestModal
          open={isRPCTestModalOpen}
          onOpenChange={setIsRPCTestModalOpen}
          onConfirm={() => {
            // Test completion is handled in handleCloseTestModal
          }}
          onClose={handleCloseTestModal}
        />

        {/* MetaMask Toggle Network Modal */}
        <MetaMaskToggleModal
          open={isMetaMaskModalOpen}
          onOpenChange={setIsMetaMaskModalOpen}
          onComplete={() => {
            rpcSetup.setRpcAddCompleted(true);
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
            rpcSetup.setRpcAddCompleted(true);
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
            rpcSetup.setRpcAddCompleted(true);
            setIsBrowserWalletModalOpen(false);
          }}
        />
      </div>

    </div>
  );
};

export default OnboardingPage;