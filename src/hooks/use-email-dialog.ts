import { useState } from 'react';

export interface UseEmailDialogReturn {
  showEmailDialog: boolean;
  setShowEmailDialog: (show: boolean) => void;
  emailInput: string;
  setEmailInput: (email: string) => void;
  emailError: string;
  validateEmail: (email: string) => boolean;
  handleEmailSubmit: (onSubmit: (email: string) => void) => void;
  reset: () => void;
  clearError: () => void;
}

/**
 * Hook to manage email dialog state and validation
 */
export function useEmailDialog(): UseEmailDialogReturn {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (email.length > 255) {
      setEmailError('Email must be less than 255 characters');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Invalid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const clearError = () => {
    setEmailError('');
  };

  const handleEmailSubmit = (onSubmit: (email: string) => void) => {
    if (validateEmail(emailInput)) {
      localStorage.setItem('userEmail', emailInput);
      onSubmit(emailInput);
      setShowEmailDialog(false);
      setEmailInput('');
      setEmailError('');
    }
  };

  const reset = () => {
    setShowEmailDialog(false);
    setEmailInput('');
    setEmailError('');
  };

  return {
    showEmailDialog,
    setShowEmailDialog,
    emailInput,
    setEmailInput,
    emailError,
    validateEmail,
    handleEmailSubmit,
    reset,
    clearError,
  };
}
