import { useState } from 'react';
import { toast } from 'sonner';
import { captureEmailAction } from '@/actions/capture-email';
import type { CaptureEmailResult } from '@/lib/email';

export interface UseEmailCaptureReturn {
  emailInput: string;
  emailError: string;
  isLoadingEmail: boolean;
  isEmailDialogOpen: boolean;
  setEmailInput: (value: string) => void;
  setEmailError: (error: string) => void;
  setIsEmailDialogOpen: (open: boolean) => void;
  handleEmailSubmit: (onSuccess: () => void) => Promise<void>;
  resetEmailForm: () => void;
}

/**
 * Hook to manage email capture form state and submission
 */
export function useEmailCapture(): UseEmailCaptureReturn {
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const handleEmailSubmit = async (onSuccess: () => void) => {
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
      } else {
        toast.success('Success!', {
          description: "You've been added to the waitlist",
        });
      }
      onSuccess();
      setIsEmailDialogOpen(false);
      setEmailInput('');
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

  const resetEmailForm = () => {
    setEmailInput('');
    setEmailError('');
    setIsEmailDialogOpen(false);
  };

  return {
    emailInput,
    emailError,
    isLoadingEmail,
    isEmailDialogOpen,
    setEmailInput,
    setEmailError,
    setIsEmailDialogOpen,
    handleEmailSubmit,
    resetEmailForm,
  };
}
