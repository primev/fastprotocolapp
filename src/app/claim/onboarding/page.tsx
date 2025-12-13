'use client';

import { useState } from 'react';
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
  MessageCircle,
  Send,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { RPCTestModal } from '@/components/network-checker';

// Hooks
import { useRPCTest } from '@/hooks/use-rpc-test';
import { useWalletInfo } from '@/hooks/use-wallet-info';
import { useOnboardingSteps, type BaseStep } from '@/hooks/use-onboarding-steps';
import { useEmailCapture } from '@/hooks/use-email-capture';
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
import { EmailDialog } from '@/components/onboarding/EmailDialog';
import { AlreadyConfiguredWallet } from '@/components/onboarding/AlreadyConfiguredWallet';

// Constants
const baseSteps: BaseStep[] = [
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

  const emailCapture = useEmailCapture();

  // Already configured wallet state - must be declared before hooks that use it
  const [alreadyConfiguredWallet, setAlreadyConfiguredWallet] = useState<boolean | null>(null);

  const rpcSetup = useRPCSetup({
    isConnected,
    connector,
    walletStepCompleted: steps.find((s) => s.id === 'wallet')?.completed || false,
    hasInitialized,
    updateStepStatus,
    rpcTest,
    alreadyConfiguredWallet: alreadyConfiguredWallet === true,
  });

  useWalletConnection({
    isConnected,
    connector,
    walletStepCompleted: steps.find((s) => s.id === 'wallet')?.completed || false,
    hasInitialized,
    updateStepStatus,
    setRpcRequired: rpcSetup.setRpcRequired,
    rpcRequired: rpcSetup.rpcRequired,
    alreadyConfiguredWallet: alreadyConfiguredWallet === true,
  });

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
  const [isAlreadyConfiguredModalOpen, setIsAlreadyConfiguredModalOpen] = useState(false);

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
      email: () => emailCapture.setIsEmailDialogOpen(true),
      wallet: () => {
        // Always show the modal when connect button is clicked
        setIsAlreadyConfiguredModalOpen(true);
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

  const handleEmailSubmit = async () => {
    await emailCapture.handleEmailSubmit(() => {
      updateStepStatus('email', true);
    });
  };

  const handleTestClick = () => {
    if (!rpcSetup.rpcAddCompleted) {
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

  const handleAlreadyConfiguredSelect = (isConfigured: boolean) => {
    setAlreadyConfiguredWallet(isConfigured);
    setIsAlreadyConfiguredModalOpen(false);
    openConnectModal();
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

      <div className="relative z-10">
        <OnboardingHeader />

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold">Setup Your Account</h1>
              <p className="text-muted-foreground text-lg">
                Complete these steps to mint your Genesis SBT
              </p>
            </div>

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
              alreadyConfiguredWallet={alreadyConfiguredWallet ?? false}
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
          </div>
        </main>
      </div>

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

      {/* Email Dialog */}
      <EmailDialog
        open={emailCapture.isEmailDialogOpen}
        onOpenChange={emailCapture.setIsEmailDialogOpen}
        emailInput={emailCapture.emailInput}
        emailError={emailCapture.emailError}
        isLoading={emailCapture.isLoadingEmail}
        onEmailChange={emailCapture.setEmailInput}
        onEmailErrorChange={emailCapture.setEmailError}
        onSubmit={handleEmailSubmit}
        onCancel={() => {
          updateStepStatus('email', true);
          emailCapture.resetEmailForm();
        }}
      />

      {/* Already Configured Wallet Modal */}
      <AlreadyConfiguredWallet
        open={isAlreadyConfiguredModalOpen}
        onSelect={handleAlreadyConfiguredSelect}
      />

    </div>
  );
};

export default OnboardingPage;