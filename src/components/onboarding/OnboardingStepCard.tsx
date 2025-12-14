'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, AlertTriangle, RefreshCw } from 'lucide-react';
import type { BaseStep } from '@/hooks/use-onboarding-steps';

interface OnboardingStepCardProps {
  step: BaseStep & { completed: boolean };
  index: number;
  showWarning?: boolean;
  isWalletStep?: boolean;
  isRpcStep?: boolean;
  isConnected?: boolean;
  isMetaMask?: boolean;
  rpcAddCompleted?: boolean;
  rpcTestCompleted?: boolean;
  rpcRequired?: boolean;
  isTesting?: boolean;
  showOnlyToggle?: boolean;
  showRefreshButton?: boolean;
  hideToggleButton?: boolean;
  alreadyConfiguredWallet?: boolean;
  onStepClick: (stepId: string) => void;
  onRpcStepClick?: () => void;
  onTestClick?: () => void;
  walletStepCompleted?: boolean;
  forceDisabled?: boolean;
}

export const OnboardingStepCard = ({
  step,
  index,
  showWarning = false,
  isWalletStep = false,
  isRpcStep = false,
  isConnected = false,
  isMetaMask = false,
  rpcAddCompleted = false,
  rpcTestCompleted = false,
  rpcRequired = false,
  isTesting = false,
  showOnlyToggle = false,
  showRefreshButton = false,
  hideToggleButton = false,
  alreadyConfiguredWallet = false,
  onStepClick,
  onRpcStepClick,
  onTestClick,
  walletStepCompleted = false,
  forceDisabled = false,
}: OnboardingStepCardProps) => {
  const Icon = step.icon;
  const isWalletStepWithWarning = isWalletStep && rpcRequired;
  const isRpcStepWithWarning = isRpcStep && showWarning;

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Card
      className={`p-4 ${
        showWarning && (isWalletStep || isRpcStep)
          ? 'bg-yellow-500/10 border-yellow-500/50'
          : step.completed
            ? 'bg-primary/5 border-primary/50'
            : 'bg-card/50 border-border/50 hover:border-primary/30'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            showWarning && (isWalletStep || isRpcStep)
              ? 'bg-yellow-500/20 text-yellow-600'
              : step.completed
                ? 'bg-primary text-primary-foreground'
                : 'bg-background'
          }`}
        >
          {showWarning && (isWalletStep || isRpcStep) ? (
            <AlertTriangle className="w-5 h-5" />
          ) : step.completed ? (
            <Check className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-semibold">
              {showWarning && isWalletStep ? 'Required step' : `Step ${index + 1}`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {isWalletStepWithWarning
              ? 'You must add Fast RPC to your wallet to continue'
              : isRpcStepWithWarning
                ? 'Page refresh required for configuration to take affect'
                : step.description}
          </p>
        </div>

        {isRpcStep && isConnected ? (
          <div className="flex gap-2">
            {showRefreshButton ? (
              <Button
                variant="outline"
                size="default"
                className="flex-shrink-0 w-28"
                onClick={handleRefresh}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            ) : (
              <>
                {/* Hide toggle/add button when alreadyConfiguredWallet is true */}
                {!hideToggleButton && (
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-shrink-0 w-28"
                    onClick={onRpcStepClick}
                    disabled={!walletStepCompleted || rpcRequired}
                  >
                    {rpcAddCompleted && <Check className="w-4 h-4 mr-1" />}
                    {isMetaMask ? 'Toggle' : 'Add'}
                  </Button>
                )}
                {/* Show test button:
                    - For happy path (alreadyConfiguredWallet === true): show when toggle is completed
                    - For not happy path (alreadyConfiguredWallet === false): hide when toggle completed (show refresh instead) */}
                {((alreadyConfiguredWallet && rpcAddCompleted) || (!showOnlyToggle && !showRefreshButton && alreadyConfiguredWallet)) && (
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-shrink-0 w-28"
                    onClick={onTestClick}
                    disabled={!walletStepCompleted || rpcRequired || isTesting}
                  >
                    {rpcTestCompleted && <Check className="w-4 h-4 mr-1" />}
                    {isTesting ? 'Testing...' : 'Test'}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Button clicked for step:', step.id, 'disabled:', step.completed && !isRpcStep && !isWalletStep);
              onStepClick(step.id);
            }}
            variant="outline"
            size="default"
            className={`flex-shrink-0 w-28 ${
              // First 4 steps: keep disabled appearance but remain clickable
              (step.id === 'follow' || step.id === 'discord' || step.id === 'telegram' || step.id === 'email') && step.completed
                ? 'opacity-50 cursor-pointer'
                : ''
            }`}
            disabled={
              forceDisabled
                ? true
                : // Community step and first 4 steps should not be disabled (remain clickable) unless forceDisabled
                (step.id === 'community' || step.id === 'follow' || step.id === 'discord' || step.id === 'telegram' || step.id === 'email')
                  ? false
                  : step.completed && !isRpcStep && !isWalletStep && !rpcRequired
            }
          >
            {step.id === 'community' && (step.completed ? 'Joined' : 'Join')}
            {step.id === 'follow' && (step.completed ? 'Following' : 'Follow')}
            {step.id === 'discord' && (step.completed ? 'Joined' : 'Join')}
            {step.id === 'telegram' && (step.completed ? 'Joined' : 'Join')}
            {step.id === 'email' && (step.completed ? 'Submitted' : 'Submit')}
            {step.id === 'wallet' &&
              (rpcRequired
                ? 'Add RPC'
                : step.completed
                  ? 'Disconnect'
                  : 'Connect')}
            {step.id === 'rpc' && 'Setup'}
          </Button>
        )}
      </div>
    </Card>
  );
};

