'use client';

import { OnboardingStepCard } from './OnboardingStepCard';
import type { BaseStep } from '@/hooks/use-onboarding-steps';

interface OnboardingStepsListProps {
  steps: (BaseStep & { completed: boolean })[];
  isWalletStepWithWarning: boolean;
  isConnected: boolean;
  isMetaMask: boolean;
  rpcAddCompleted: boolean;
  rpcTestCompleted: boolean;
  rpcRequired: boolean;
  isTesting: boolean;
  walletStepCompleted: boolean;
  alreadyConfiguredWallet?: boolean;
  onStepClick: (stepId: string) => void;
  onRpcStepClick: () => void;
  onTestClick: () => void;
}

export const OnboardingStepsList = ({
  steps,
  isWalletStepWithWarning,
  isConnected,
  isMetaMask,
  rpcAddCompleted,
  rpcTestCompleted,
  rpcRequired,
  isTesting,
  walletStepCompleted,
  alreadyConfiguredWallet = false,
  onStepClick,
  onRpcStepClick,
  onTestClick,
}: OnboardingStepsListProps) => {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isWalletStep = step.id === 'wallet';
        const isRpcStep = step.id === 'rpc';
        const showWarning = isWalletStep && (isWalletStepWithWarning || rpcRequired);
        
        // Show warning on step 6 if toggle is completed and alreadyConfiguredWallet is false (not happy path)
        // alreadyConfiguredWallet === false means they said "No" or "Unsure" (not happy path)
        // When toggle is completed on not happy path: show refresh button, hide test button
        const showRpcWarning = isRpcStep && !alreadyConfiguredWallet && rpcAddCompleted && !rpcTestCompleted;
        // Only show toggle button (hide test) when alreadyConfiguredWallet is false and toggle not completed
        // For happy path: when toggle is completed, show test button (unhide it)
        const showOnlyToggle = isRpcStep && !alreadyConfiguredWallet && !rpcAddCompleted;

        return (
          <OnboardingStepCard
            key={step.id}
            step={step}
            index={index}
            showWarning={showWarning || showRpcWarning}
            isWalletStep={isWalletStep}
            isRpcStep={isRpcStep}
            isConnected={isConnected}
            isMetaMask={isMetaMask}
            rpcAddCompleted={rpcAddCompleted}
            rpcTestCompleted={rpcTestCompleted}
            rpcRequired={rpcRequired}
            isTesting={isTesting}
            walletStepCompleted={walletStepCompleted}
            showOnlyToggle={showOnlyToggle}
            showRefreshButton={showRpcWarning}
            alreadyConfiguredWallet={alreadyConfiguredWallet}
            onStepClick={onStepClick}
            onRpcStepClick={isRpcStep ? onRpcStepClick : undefined}
            onTestClick={isRpcStep ? onTestClick : undefined}
          />
        );
      })}
    </div>
  );
};

