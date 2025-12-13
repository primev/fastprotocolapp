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
  onStepClick,
  onRpcStepClick,
  onTestClick,
}: OnboardingStepsListProps) => {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isWalletStep = step.id === 'wallet';
        const isRpcStep = step.id === 'rpc';
        const showWarning =
          (isWalletStepWithWarning && isWalletStep);

        return (
          <OnboardingStepCard
            key={step.id}
            step={step}
            index={index}
            showWarning={showWarning}
            isWalletStep={isWalletStep}
            isRpcStep={isRpcStep}
            isConnected={isConnected}
            isMetaMask={isMetaMask}
            rpcAddCompleted={rpcAddCompleted}
            rpcTestCompleted={rpcTestCompleted}
            rpcRequired={rpcRequired}
            isTesting={isTesting}
            walletStepCompleted={walletStepCompleted}
            onStepClick={onStepClick}
            onRpcStepClick={isRpcStep ? onRpcStepClick : undefined}
            onTestClick={isRpcStep ? onTestClick : undefined}
          />
        );
      })}
    </div>
  );
};

