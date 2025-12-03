'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SwitchNetworkMessage } from './switch-network-message';

interface ProgrammaticSetupStepsProps {
    steps: {
        step1Completed: boolean;
        step2Completed: boolean;
        step3Completed: boolean;
    };
    isConnecting: boolean;
    isInstalling: boolean;
    isTesting: boolean;
    onConnect: () => void;
    onInstall: () => void;
    onTest: () => void;
}

/**
 * Reusable component for programmatic wallet setup steps
 */
export function ProgrammaticSetupSteps({
    steps,
    isConnecting,
    isInstalling,
    isTesting,
    onConnect,
    onInstall,
    onTest,
}: ProgrammaticSetupStepsProps) {
    return (
        <div className="space-y-4">
            {/* Step 1: Approve wallet request */}
            <div className="flex gap-4 items-start">
                <div
                    className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                        steps.step1Completed
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-primary/20 text-primary'
                    )}
                >
                    {steps.step1Completed ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="font-medium">Approve wallet request</p>
                        {steps.step1Completed && (
                            <span className="text-xs text-green-500">Completed</span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Connect your MetaMask wallet to continue.
                    </p>
                    {!steps.step1Completed && (
                        <Button onClick={onConnect} disabled={isConnecting} size="sm">
                            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Step 2: Automatically add network */}
            <div className="flex gap-4 items-start">
                <div
                    className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                        steps.step2Completed
                            ? 'bg-green-500/20 text-green-500'
                            : steps.step1Completed
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                    )}
                >
                    {steps.step2Completed ? <CheckCircle2 className="w-5 h-5" /> : '2'}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="font-medium">Automatically add network</p>
                        {steps.step2Completed && (
                            <span className="text-xs text-green-500">Completed</span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Add the Fast Protocol network to your wallet automatically.
                    </p>
                    {!steps.step2Completed && (
                        <Button
                            onClick={onInstall}
                            disabled={!steps.step1Completed || isInstalling}
                            size="sm"
                        >
                            {isInstalling ? 'Installing...' : 'Add Network'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Important: Switch to network */}
            {steps.step2Completed && !steps.step3Completed && (
                <div className="pt-2">
                    <SwitchNetworkMessage walletName="MetaMask" />
                </div>
            )}

            {/* Step 3: Test RPC connection */}
            <div className="flex gap-4 items-start">
                <div
                    className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                        steps.step3Completed
                            ? 'bg-green-500/20 text-green-500'
                            : steps.step2Completed
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                    )}
                >
                    {steps.step3Completed ? <CheckCircle2 className="w-5 h-5" /> : '3'}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="font-medium">Test RPC connection</p>
                        {steps.step3Completed && (
                            <span className="text-xs text-green-500">Completed</span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Test the Fast Protocol RPC connection by sending a zero-value transaction
                        to yourself.
                    </p>

                    {!steps.step3Completed && (
                        <Button
                            onClick={onTest}
                            disabled={!steps.step2Completed || isTesting}
                            size="sm"
                        >
                            {isTesting ? 'Testing...' : 'Test RPC'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

