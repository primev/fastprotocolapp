'use client';

import { useState, useEffect, useMemo } from 'react';
import { useConnectors } from 'wagmi';

export interface DiscoveredWallet {
  id: string;
  rdns: string;
  name: string;
  icon?: string;
  connector?: any;
  provider?: {
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
}

const METAMASK_DETECTION_DELAY = 500;
const WALLET_DETECTION_TIMEOUT = 5000; // Fallback timeout if no wallets respond

/**
 * Hook to discover wallets via EIP-6963 and categorize them
 * Uses EIP-6963 events directly to get wallet info with icons
 */
export function useWalletDiscovery() {
  const [detectedWallets, setDetectedWallets] = useState<Array<{
    name: string;
    icon?: string;
    rdns: string;
    provider?: {
      request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const connectors = useConnectors();

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let wallets: Array<{
      name: string;
      icon?: string;
      rdns: string;
      provider?: {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
    }> = [];
    let hasStoppedLoading = false;

    const stopLoading = () => {
      if (!hasStoppedLoading) {
        hasStoppedLoading = true;
        setIsLoading(false);
      }
    };

    const updateWallets = () => {
      setDetectedWallets([...wallets]);
      if (wallets.length > 0) {
        stopLoading();
      }
    };

    const handleAnnouncement = (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{
          info: { name: string; icon?: string; rdns: string };
          provider?: {
            request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          };
        }>;
        const walletInfo = customEvent.detail?.info;
        const provider = customEvent.detail?.provider;

        if (walletInfo && !wallets.find((w) => w.rdns === walletInfo.rdns)) {
          wallets.push({
            name: walletInfo.name,
            ...(walletInfo.icon && { icon: walletInfo.icon }),
            rdns: walletInfo.rdns,
            ...(provider && { provider }),
          });
          // Update immediately when wallet is found
          updateWallets();
        }
      } catch (err) {
        console.error('[WalletDiscovery] Error handling announcement:', err);
      }
    };

    window.addEventListener('eip6963:announceProvider', handleAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Handle MetaMask fallback (it may not announce via EIP-6963 immediately)
    const win = window as unknown as { ethereum?: { isMetaMask?: boolean } };
    const metamaskTimeout = setTimeout(() => {
      const existingMetaMask = wallets.find((w) => w.rdns === 'io.metamask');
      if (win.ethereum && win.ethereum.isMetaMask && !existingMetaMask) {
        wallets.push({
          name: 'MetaMask',
          icon: 'data:image/svg+xml,%3Csvg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M29.3333 10H26.6667V22.6667H29.3333V10Z" fill="%23FF6888"/%3E%3Cpath d="M16 10H13.3333V22.6667H16V10Z" fill="%23FF6888"/%3E%3Cpath d="M2.66667 10H0V22.6667H2.66667V10Z" fill="%23FF6888"/%3E%3Cpath d="M29.3333 9.33333H26.6667L24.6667 5.33333H19.3333L17.3333 9.33333H14.6667L12.6667 5.33333H7.33333L15.3333 5.33333H16.6667L24.6667 5.33333H26.6667L29.3333 9.33333Z" fill="%23E2761D"/%3E%3C/svg%3E',
          rdns: 'io.metamask',
        });
        // Update immediately when MetaMask is found
        updateWallets();
      }
    }, METAMASK_DETECTION_DELAY);

    // Fallback timeout - always stop loading after timeout
    const timeoutId = setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
      setDetectedWallets([...wallets]);
      stopLoading();
    }, WALLET_DETECTION_TIMEOUT);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(metamaskTimeout);
      window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
    };
  }, []);

  const wallets = useMemo(() => {
    const discovered: DiscoveredWallet[] = [];
    const seenRdns = new Set<string>();

    // Process EIP-6963 detected wallets
    detectedWallets.forEach((wallet) => {
      if (seenRdns.has(wallet.rdns)) return;
      seenRdns.add(wallet.rdns);

      // Find matching connector if available
      const connector = connectors.find((c) => {
        const connectorId = c.id.toLowerCase();
        return connectorId.includes(wallet.rdns.toLowerCase()) ||
               wallet.rdns.toLowerCase().includes(connectorId);
      });

      discovered.push({
        id: wallet.rdns,
        rdns: wallet.rdns,
        name: wallet.name,
        icon: wallet.icon,
        connector,
        provider: wallet.provider,
      });
    });

    // Sort by name
    return discovered.sort((a, b) => a.name.localeCompare(b.name));
  }, [detectedWallets, connectors]);

  return {
    wallets,
    isLoading,
  };
}

