'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export type FeedbackStatus = 'slow' | 'normal' | 'fast';

interface TransactionFeedbackModalProps {
  isOpen: boolean;
  walletAddress: string | undefined;
  onClose: () => void;
}

interface FeedbackOption {
  status: FeedbackStatus;
  label: string;
  color: string;
  hoverColor: string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  {
    status: 'slow',
    label: 'Slow',
    color: 'text-yellow-600 dark:text-yellow-400',
    hoverColor: 'hover:bg-yellow-500/10 hover:border-yellow-500/30',
  },
  {
    status: 'normal',
    label: 'Normal',
    color: 'text-stone-200 dark:text-stone-300',
    hoverColor: 'hover:bg-stone-100/20 hover:border-stone-200/30',
  },
  {
    status: 'fast',
    label: 'Fast',
    color: 'text-green-600 dark:text-green-400',
    hoverColor: 'hover:bg-green-500/10 hover:border-green-500/30',
  },
];

export function TransactionFeedbackModal({
  isOpen,
  walletAddress,
  onClose,
}: TransactionFeedbackModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleFeedbackSelect = (status: FeedbackStatus) => {
    if (selectedStatus || !walletAddress || isClosing) {
      return;
    }

    setSelectedStatus(status);
    setIsClosing(true);
    
    const txhash = localStorage.getItem('claimTxHash');

    // Submit feedback in the background (fire and forget)
    fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        wallet_address: walletAddress,
        tx_type: 'mint',
        status: status,
        txhash: txhash || undefined,
      }),
    })
      .catch((error) => {
        // Silently handle errors - user doesn't need to see them
        console.error('Failed to submit feedback:', error);
      })
      .finally(() => {
        // Remove txhash from localStorage after submission (success or failure)
        if (txhash) {
          localStorage.removeItem('claimTxHash');
        }
      });

    setTimeout(() => {
      onClose();
      // Reset state after closing for next time
      setTimeout(() => {
        setSelectedStatus(null);
        setIsClosing(false);
      }, 500);
    }, 500); // Match animation duration
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'w-[320px] max-w-[calc(100vw-48px)]',
        'transition-all duration-500 ease-in-out',
        isClosing
          ? 'opacity-0 scale-95 translate-y-2 translate-x-[10px] pointer-events-none'
          : 'opacity-100 scale-100 translate-y-0 translate-x-0'
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      style={{
        pointerEvents: 'auto',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <Card className="p-4 bg-card/95 backdrop-blur-sm border-primary/30 glow-border shadow-2xl">
        <div className="flex justify-center">
          <Image src="/assets/fast-protocol-logo-icon.png" alt="Fast Protocol" width={100} height={100} />
        </div>
        {/* Question */}
        <h2
          id="feedback-title"
          className="text-base font-semibold text-center mb-4 text-foreground"
        >
          How fast was your transaction?
        </h2>

        {/* Feedback Options */}
        <div className="flex justify-center gap-2">
          {FEEDBACK_OPTIONS.map((option) => {
            const isSelected = selectedStatus === option.status;
            const isDisabled = selectedStatus !== null;

            return (
              <button
                key={option.status}
                type="button"
                onClick={() => handleFeedbackSelect(option.status)}
                disabled={isDisabled}
                className={cn(
                  'flex items-center justify-center',
                  'px-4 py-2 rounded-lg',
                  'border transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  'bg-card border-border',
                  'text-sm font-medium',
                  option.color,
                  !isDisabled && option.hoverColor,
                  isDisabled && 'opacity-50 cursor-not-allowed',
                  isSelected && 'ring-2 ring-offset-2 ring-primary border-primary/50 bg-primary/5'
                )}
                aria-label={`Select ${option.label}`}
                aria-pressed={isSelected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
