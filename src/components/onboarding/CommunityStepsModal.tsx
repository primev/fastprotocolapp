'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OnboardingStepCard } from './OnboardingStepCard';
import { Twitter, MessageCircle, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { BaseStep } from '@/hooks/use-onboarding-steps';
import { getCompletedCommunitySteps, saveOnboardingStepToStorage } from '@/lib/onboarding-utils';

interface CommunityStepsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllStepsCompleted: () => void;
  onEmailDialogOpen: () => void;
}

export interface CommunityStepsModalRef {
  markEmailCompleted: () => void;
}

const communitySteps: BaseStep[] = [
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
];

export const CommunityStepsModal = forwardRef<CommunityStepsModalRef, CommunityStepsModalProps>(({
  open,
  onOpenChange,
  onAllStepsCompleted,
  onEmailDialogOpen,
}, ref) => {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    // Load from localStorage on mount
    const completed = getCompletedCommunitySteps();
    return new Set(completed);
  });
  const hasCalledCompletion = useRef(false);

  useImperativeHandle(ref, () => ({
    markEmailCompleted: () => {
      updateStepStatus('email', true);
    },
  }));

  const updateStepStatus = (stepId: string, completed: boolean) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (completed) {
        newSet.add(stepId);
      } else {
        newSet.delete(stepId);
      }
      
      // Save to localStorage using utility function
      saveOnboardingStepToStorage(stepId, completed);
      
      return newSet;
    });
  };

  const handleStepClick = (stepId: string) => {
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
      email: () => {
        onEmailDialogOpen();
      },
    };

    actions[stepId]?.();
  };

  // Check if all steps are completed
  const allStepsCompleted = communitySteps.every((step) => completedSteps.has(step.id));

  // When all steps are completed, call the callback (only once)
  useEffect(() => {
    if (allStepsCompleted && completedSteps.size === communitySteps.length && !hasCalledCompletion.current) {
      hasCalledCompletion.current = true;
      onAllStepsCompleted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps.size]);

  // Reset completion flag when modal closes
  useEffect(() => {
    if (!open) {
      hasCalledCompletion.current = false;
    }
  }, [open]);

  const stepsWithStatus = communitySteps.map((step) => ({
    ...step,
    completed: completedSteps.has(step.id),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-2xl border-primary/50 max-h-[100vh] sm:max-h-[90vh] flex flex-col m-0 sm:m-4 rounded-none sm:rounded-lg inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Join Our Community</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Complete all steps to continue
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {stepsWithStatus.map((step, index) => {
            return (
              <OnboardingStepCard
                key={step.id}
                step={step}
                index={index}
                onStepClick={handleStepClick}
                walletStepCompleted={false}
                isWalletStep={false}
                isRpcStep={false}
                isConnected={false}
                isMetaMask={false}
                rpcAddCompleted={false}
                rpcTestCompleted={false}
                rpcRequired={false}
                isTesting={false}
                showWarning={false}
                showRefreshButton={false}
                hideToggleButton={false}
                forceDisabled={false}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
});

CommunityStepsModal.displayName = 'CommunityStepsModal';
