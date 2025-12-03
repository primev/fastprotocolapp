/**
 * Utility functions for wallet provider management
 */

/**
 * Get the MetaMask provider from window.ethereum
 * Handles multiple provider scenarios (array, providers array, single provider)
 */
export function getMetaMaskProvider(): any | null {
    if (typeof window === 'undefined') return null;
    
    const win = window as any;
    if (!win.ethereum) return null;

    let provider: any = win.ethereum;
    
    // Handle array of providers
    if (Array.isArray(provider)) {
        provider = provider.find((p: any) => p.isMetaMask) || provider[0];
    } 
    // Handle providers object with array
    else if (provider.providers && Array.isArray(provider.providers)) {
        provider = provider.providers.find((p: any) => p.isMetaMask) || provider.providers[0];
    }

    return provider?.request && (provider.isMetaMask || provider) ? provider : null;
}

