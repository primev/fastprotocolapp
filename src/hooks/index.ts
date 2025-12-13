// Network setup hooks
export { useNetworkInstallation, type UseNetworkInstallationReturn } from './use-network-installation';
export { useRPCTest, type UseRPCTestReturn } from './use-rpc-test';

// Wallet hooks
export { useWalletInfo, type UseWalletInfoReturn } from './use-wallet-info';

// Onboarding hooks
export { useOnboardingSteps, type UseOnboardingStepsReturn, type Step, type BaseStep } from './use-onboarding-steps';
export { useEmailCapture, type UseEmailCaptureReturn } from './use-email-capture';
export { useSmartAccountDetection, type UseSmartAccountDetectionReturn } from './use-smart-account-detection';
export { useRPCSetup, type UseRPCSetupReturn } from './use-rpc-setup';
export { useWalletConnection, type UseWalletConnectionReturn } from './use-wallet-connection';
export { useMinting, type UseMintingReturn } from './use-minting';

// Other hooks
export { useToast } from './use-toast';
export { useIsMobile } from './use-mobile';