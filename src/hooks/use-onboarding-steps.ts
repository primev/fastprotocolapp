import { useState, useEffect, useRef } from 'react';
import { ONBOARDING_STORAGE_KEY, SOCIAL_STEP_IDS } from '@/lib/onboarding-utils';

export type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
};

export type BaseStep = Omit<Step, 'completed'>;

export interface UseOnboardingStepsProps {
  baseSteps: BaseStep[];
  isConnected: boolean;
}

export interface UseOnboardingStepsReturn {
  steps: Step[];
  updateStepStatus: (stepId: string, completed: boolean) => void;
  allStepsCompleted: boolean;
  hasInitialized: boolean;
}

/**
 * Hook to manage onboarding steps state and localStorage persistence
 */
export function useOnboardingSteps({
  baseSteps,
  isConnected,
}: UseOnboardingStepsProps): UseOnboardingStepsReturn {
  const [steps, setSteps] = useState<Step[]>(() =>
    baseSteps.map(step => ({ ...step, completed: false }))
  );
  const hasInitialized = useRef(false);

  /**
   * Load steps from localStorage and merge with current state
   */
  const loadStepsFromStorage = () => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const saved = stored ? JSON.parse(stored) : {};
      setSteps((prevSteps) => {
        return baseSteps.map(step => {
          // For social steps, load from localStorage
          if (SOCIAL_STEP_IDS.includes(step.id as typeof SOCIAL_STEP_IDS[number])) {
            return { ...step, completed: saved[step.id] === true };
          }
          // For wallet step, preserve current state if connected, otherwise use saved or false
          if (step.id === 'wallet') {
            return { ...step, completed: isConnected || (saved[step.id] === true) };
          }
          // For RPC step, preserve current state
          if (step.id === 'rpc') {
            const currentRpcStep = prevSteps.find(s => s.id === 'rpc');
            return { ...step, completed: currentRpcStep?.completed || false };
          }
          return { ...step, completed: false };
        });
      });
    } catch (error) {
      console.error('Error loading onboarding steps:', error);
    }
  };

  /**
   * Update step status and persist social steps to localStorage
   */
  const updateStepStatus = (stepId: string, completed: boolean) => {
    setSteps((prev) => {
      const updated = prev.map((step) =>
        step.id === stepId ? { ...step, completed } : step
      );

      // Save social steps to localStorage
      if (SOCIAL_STEP_IDS.includes(stepId as typeof SOCIAL_STEP_IDS[number])) {
        try {
          const saved = updated.reduce((acc, step) => {
            if (SOCIAL_STEP_IDS.includes(step.id as typeof SOCIAL_STEP_IDS[number])) {
              acc[step.id] = step.completed;
            }
            return acc;
          }, {} as Record<string, boolean>);
          localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(saved));
        } catch (error) {
          console.error('Error saving onboarding steps:', error);
        }
      }

      return updated;
    });
  };

  // Initialize: load steps from localStorage on mount
  useEffect(() => {
    loadStepsFromStorage();
    hasInitialized.current = true;
  }, []);

  // Listen for wallet disconnection and reload steps
  useEffect(() => {
    if (!hasInitialized.current) return;
    if (!isConnected) {
      loadStepsFromStorage();
    }
  }, [isConnected]);

  // Listen for localStorage changes (when cleared externally)
  useEffect(() => {
    if (!hasInitialized.current) return;

    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === ONBOARDING_STORAGE_KEY || e.key === 'completedTasks') && !isConnected) {
        if (e.newValue === null || e.key === ONBOARDING_STORAGE_KEY) {
          loadStepsFromStorage();
        }
      }
    };

    const handleFocus = () => {
      if (!isConnected && !localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
        loadStepsFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected]);

  const allStepsCompleted = steps.every((step) => step.completed);

  return {
    steps,
    updateStepStatus,
    allStepsCompleted,
    hasInitialized: hasInitialized.current,
  };
}
