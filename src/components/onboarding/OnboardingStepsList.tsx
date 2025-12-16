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
  refreshProcessed?: boolean;
  isTesting: boolean;
  walletStepCompleted: boolean;
  alreadyConfiguredWallet?: boolean;
  onStepClick: (stepId: string) => void;
  onRpcStepClick: () => void;
  onTestClick: () => void;
  onRefresh?: () => void;
}

export const OnboardingStepsList = ({
  steps,
  isWalletStepWithWarning,
  isConnected,
  isMetaMask,
  rpcAddCompleted,
  rpcTestCompleted,
  rpcRequired,
  refreshProcessed = false,
  isTesting,
  walletStepCompleted,
  alreadyConfiguredWallet = false,
  onStepClick,
  onRpcStepClick,
  onTestClick,
  onRefresh,
}: OnboardingStepsListProps) => {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isWalletStep = step.id === 'wallet';
        const isRpcStep = step.id === 'rpc';
        const showWarning = isWalletStep && (isWalletStepWithWarning || rpcRequired);
        const showRpcWarning = isRpcStep && !alreadyConfiguredWallet && rpcAddCompleted && !rpcTestCompleted && !refreshProcessed;
        const hideToggleButton = isRpcStep && (alreadyConfiguredWallet || refreshProcessed);

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
            showRefreshButton={showRpcWarning}
            hideToggleButton={hideToggleButton}
            refreshProcessed={refreshProcessed}
            onStepClick={onStepClick}
            onRpcStepClick={isRpcStep ? onRpcStepClick : undefined}
            onTestClick={isRpcStep ? onTestClick : undefined}
            onRefresh={isRpcStep ? onRefresh : undefined}
          />
        );
      })}
    </div>
  );
};

