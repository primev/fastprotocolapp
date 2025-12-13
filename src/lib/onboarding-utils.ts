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
export const SOCIAL_STEP_IDS = ['follow', 'discord', 'telegram', 'email'] as const;

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
