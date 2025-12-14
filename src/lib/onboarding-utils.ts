import { Connector } from 'wagmi';
import { getWalletName } from './wallet-provider';
import { CONTRACT_ADDRESS } from './contract-config';

/**
 * Storage key for onboarding steps in localStorage
 */
export const ONBOARDING_STORAGE_KEY = 'onboardingSteps';

/**
 * Step IDs that are social-related and should be persisted to localStorage
 */
export const SOCIAL_STEP_IDS = ['community', 'follow', 'discord', 'telegram', 'email'] as const;

/**
 * Community step IDs that need to be completed
 */
export const COMMUNITY_STEP_IDS = ['follow', 'discord', 'telegram', 'email'] as const;

/**
 * Type for onboarding steps storage
 */
export type OnboardingStepsStorage = Record<string, boolean>;

/**
 * Safely reads and parses onboarding steps from localStorage
 * Returns an empty object if there's an error or no data
 */
export function getOnboardingStepsFromStorage(): OnboardingStepsStorage {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as OnboardingStepsStorage;
    }
  } catch (error) {
    console.error('Error loading onboarding steps from localStorage:', error);
  }
  return {};
}

/**
 * Gets completion status for a specific step from localStorage
 * Returns false if the step is not found or there's an error
 */
export function getOnboardingStepFromStorage(stepId: string): boolean {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      const saved = JSON.parse(stored) as OnboardingStepsStorage;
      return saved[stepId] === true;
    }
  } catch (error) {
    console.error('Error reading onboarding step from localStorage:', error);
  }
  return false;
}

/**
 * Updates a single step in localStorage
 * Merges with existing data to preserve other steps
 */
export function saveOnboardingStepToStorage(stepId: string, completed: boolean): void {
  try {
    const existing = getOnboardingStepsFromStorage();
    existing[stepId] = completed;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error('Error saving onboarding step to localStorage:', error);
  }
}

/**
 * Saves multiple onboarding steps to localStorage at once
 * Merges with existing data to preserve other steps
 */
export function saveOnboardingStepsToStorage(steps: OnboardingStepsStorage): void {
  try {
    const existing = getOnboardingStepsFromStorage();
    const merged = { ...existing, ...steps };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Error saving onboarding steps to localStorage:', error);
  }
}

/**
 * Returns array of completed community step IDs
 */
export function getCompletedCommunitySteps(): string[] {
  try {
    const saved = getOnboardingStepsFromStorage();
    return COMMUNITY_STEP_IDS.filter(id => saved[id] === true);
  } catch (error) {
    console.error('Error getting completed community steps:', error);
    return [];
  }
}

/**
 * Checks if all community steps (follow, discord, telegram, email) are completed
 */
export function areCommunityStepsCompleted(): boolean {
  try {
    const saved = getOnboardingStepsFromStorage();
    return COMMUNITY_STEP_IDS.every(id => saved[id] === true);
  } catch (error) {
    console.error('Error checking community steps completion:', error);
    return false;
  }
}

/**
 * ERC721 Transfer event signature
 */
export const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Check if the connected wallet is MetaMask
 */
export function isMetaMaskWallet(connector: Connector | undefined): boolean {
  if (!connector) return false;
  const walletName = getWalletName(connector);
  return walletName.toLowerCase() === 'metamask';
}

/**
 * Check if the connected wallet is Rabby
 */
export function isRabbyWallet(connector: Connector | undefined): boolean {
  if (!connector) return false;
  const walletName = getWalletName(connector);
  return walletName.toLowerCase() === 'rabby';
}

/**
 * Parse token ID from transaction receipt logs
 * Looks for ERC721 Transfer event with the token ID in topics[3]
 */
export function parseTokenIdFromReceipt(
  receipt: { logs?: Array<{ address?: string; topics?: readonly string[] }> }
): bigint | null {
  if (!receipt?.logs?.length) return null;

  const contractAddressLower = CONTRACT_ADDRESS.toLowerCase();

  for (const log of receipt.logs) {
    const logAddress = (log.address || '').toLowerCase();
    const topics = log.topics || [];

    if (
      topics[0]?.toLowerCase() === TRANSFER_EVENT_SIGNATURE.toLowerCase() &&
      logAddress === contractAddressLower &&
      topics[3]
    ) {
      try {
        console.log('Parsed token ID:', topics[3]);
        return BigInt(topics[3]);
      } catch {
        return null;
      }
    }
  }

  return null;
}
