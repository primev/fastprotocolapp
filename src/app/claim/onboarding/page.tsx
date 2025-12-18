'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, usePublicClient } from 'wagmi';
import { isAddress } from 'viem';
import { Fuul } from '@fuul/sdk';

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

import '@/lib/fuul';

// Constants
const baseSteps: BaseStep[] = [
  {
    id: 'follow',
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

const OnboardingPageContent = () => {
  const searchParams = useSearchParams();
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


  const hasSentPageviewRef = useRef(false);
  const hasSentConnectWalletRef = useRef(false);

  // Referral tracking: send pageview if present and valid (address or affiliate code)
  useEffect(() => {
    const referralParam = searchParams.get('af');
    if (referralParam && !hasSentPageviewRef.current) {
      // Accept both addresses and affiliate codes
      // Addresses are 0x followed by 40 hex characters
      // Affiliate codes are alphanumeric with dashes
      const isValidAddress = isAddress(referralParam);
      const isValidCode = /^[a-zA-Z0-9-]+$/.test(referralParam) && referralParam.length <= 30;
      
      if (isValidAddress || isValidCode) {
        Fuul.sendPageview('claim/onboarding');
        hasSentPageviewRef.current = true;
      }
    }
  }, [searchParams]);

  // Send connect_wallet event when wallet connects (only once)
  useEffect(() => {
    if (!isConnected || !address || hasSentConnectWalletRef.current) {
      return;
    }

    const sendConnectWalletEvent = async () => {
      try {
        // Get tracking_id
        const trackingId = localStorage.getItem('fuul.tracking_id');
        if (!trackingId) {
          console.warn('Fuul tracking_id not found in localStorage');
          return;
        }

        // Call identify-user API which sends connect_wallet event
        const response = await fetch('/api/fuul/identify-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: address,
            identifierType: 'evm_address',
            trackingId: trackingId,
            accountChainId: 1,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Failed to send connect_wallet event:', error);
          return;
        }

        hasSentConnectWalletRef.current = true;
        console.log('connect_wallet event sent successfully');
      } catch (error) {
        console.error('Error sending connect_wallet event:', error);
      }
    };

    sendConnectWalletEvent();
  }, [isConnected, address]);

  // Check if follow step is completed on mount
  useEffect(() => {
    if (!hasInitialized) return;

    const saved = localStorage.getItem('onboardingSteps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.follow === true) {
          const followStep = steps.find(s => s.id === 'follow');
          if (followStep && !followStep.completed) {
            updateStepStatus('follow', true);
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
    publicClient
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
      follow: () => {
        window.open('https://twitter.com/intent/follow?screen_name=fast_protocol', '_blank');
        toast.success('Please follow @fast_protocol to continue');
        setTimeout(() => {
          updateStepStatus('follow', true);
          // Save 'follow' to localStorage
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
    // Also allow if refresh was processed (after refresh, toggle/add is considered complete)
    if (!alreadyConfiguredWallet && !rpcSetup.rpcAddCompleted && !rpcSetup.refreshProcessed) {
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

      <div className="relative z-10 flex flex-col min-h-screen">
        <OnboardingHeader />

        <main className="w-full px-4 lg:container lg:mx-auto xl:container xl:mx-auto 2xl:container 2xl:mx-auto flex-1 flex items-center justify-center">
          <div className="w-full lg:max-w-3xl xl:max-w-3xl 2xl:max-w-3xl mx-auto space-y-6 sm:space-y-8 lg:space-y-5">
            <OnboardingStepsList
              steps={steps}
              isWalletStepWithWarning={isWalletStepWithWarning}
              isConnected={isConnected}
              isMetaMask={isMetaMask}
              rpcAddCompleted={rpcSetup.rpcAddCompleted}
              rpcTestCompleted={rpcSetup.rpcTestCompleted}
              rpcRequired={rpcSetup.rpcRequired}
              refreshProcessed={rpcSetup.refreshProcessed}
              isTesting={rpcTest.isTesting}
              walletStepCompleted={walletStep?.completed || false}
              alreadyConfiguredWallet={alreadyConfiguredWallet}
              onStepClick={handleStepClick}
              onRpcStepClick={handleRpcStepClick}
              onTestClick={handleTestClick}
              onRefresh={rpcSetup.handleRefresh}
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

const OnboardingPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
};

export default OnboardingPage;