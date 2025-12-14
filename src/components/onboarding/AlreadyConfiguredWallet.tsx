'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Check, X, HelpCircle } from 'lucide-react';

interface AlreadyConfiguredWalletProps {
    open: boolean;
    onSelect: (isConfigured: boolean) => void;
}

export const AlreadyConfiguredWallet = ({
    open,
    onSelect,
}: AlreadyConfiguredWalletProps) => {
    const handleSelect = (isConfigured: boolean) => {
        onSelect(isConfigured);
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent
                hideClose
                className="w-full h-full sm:h-auto sm:max-w-lg border-primary/50 max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 rounded-none sm:rounded-lg left-0 top-0 sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-6 sm:p-8">
                <DialogHeader className="flex-shrink-0 text-center">
                    <div className="flex justify-center mb-4">
                        <Image
                            src="/assets/fast-protocol-logo-icon.png"
                            alt="Fast Protocol"
                            width={150}
                            height={150}
                            className="hidden sm:block"
                        />
                    </div>
                    <DialogTitle className="text-xl sm:text-2xl text-center">
                        Is your wallet already configured?
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col justify-center space-y-4 py-6">
                    <div className="space-y-3">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full justify-start h-auto py-4 px-4 hover:bg-primary/10 hover:border-primary/50"
                            onClick={() => handleSelect(true)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                    <Check className="!w-8 !h-8 text-green-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold">Yes, it's configured</div>
                                    <div className="text-xs text-muted-foreground">
                                        My wallet is already set up with Fast RPC
                                    </div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full justify-start h-auto py-4 px-4 hover:bg-primary/10 hover:border-primary/50"
                            onClick={() => handleSelect(false)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                    <X className="!w-8 !h-8 text-red-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold">No, it's not configured</div>
                                    <div className="text-xs text-muted-foreground">
                                        I need to set up Fast RPC in my wallet
                                    </div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full justify-start h-auto py-4 px-4 hover:bg-primary/10 hover:border-primary/50"
                            onClick={() => handleSelect(false)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                                    <HelpCircle className="!w-8 !h-8 text-yellow-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold">I'm not sure</div>
                                    <div className="text-xs text-muted-foreground">
                                        I don't know if my wallet is configured
                                    </div>
                                </div>
                            </div>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

