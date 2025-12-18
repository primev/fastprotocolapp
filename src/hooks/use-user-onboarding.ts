import { useState, useEffect } from 'react';

export type UserOnboardingData = {
  connect_wallet_completed: boolean;
  setup_rpc_completed: boolean;
  mint_sbt_completed: boolean;
  x_completed: boolean;
  telegram_completed: boolean;
  discord_completed: boolean;
  email_completed: boolean;
};

export interface UseUserOnboardingReturn {
  userOnboarding: UserOnboardingData | null;
  isLoadingOnboarding: boolean;
  updateUserOnboarding: (updates: Record<string, boolean>) => Promise<boolean>;
  hasInitialized: boolean;
}

/**
 * Hook to manage user onboarding data fetching and updates
 */
export function useUserOnboarding(
  isConnected: boolean,
  address: string | undefined
): UseUserOnboardingReturn {
  const [userOnboarding, setUserOnboarding] = useState<UserOnboardingData | null>(null);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch user onboarding data from API
  const fetchUserOnboarding = async (walletAddress: string) => {
    if (!walletAddress) {
      setHasInitialized(true);
      return;
    }
    
    setIsLoadingOnboarding(true);
    try {
      const response = await fetch(`/api/user-onboarding/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        setUserOnboarding(data.user);
      } else if (response.status === 404) {
        // User doesn't exist yet, that's okay
        setUserOnboarding(null);
      } else {
        console.error('Failed to fetch user onboarding:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching user onboarding:', error);
    } finally {
      setIsLoadingOnboarding(false);
      setHasInitialized(true);
    }
  };

  // Update user onboarding in database
  const updateUserOnboarding = async (updates: Record<string, boolean>): Promise<boolean> => {
    if (!address) return false;

    try {
      const response = await fetch(`/api/user-onboarding/${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setUserOnboarding(data.user);
        return true;
      } else {
        const error = await response.json();
        console.error('Failed to update user onboarding:', error);
        return false;
      }
    } catch (error) {
      console.error('Error updating user onboarding:', error);
      return false;
    }
  };

  // Fetch user onboarding when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      fetchUserOnboarding(address);
    } else {
      setUserOnboarding(null);
      setHasInitialized(true); // Mark as initialized even when disconnected
    }
  }, [isConnected, address]);

  return {
    userOnboarding,
    isLoadingOnboarding,
    updateUserOnboarding,
    hasInitialized,
  };
}
