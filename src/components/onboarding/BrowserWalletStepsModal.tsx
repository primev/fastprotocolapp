'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, AlertCircle } from 'lucide-react';
import { NetworkDetailsTab } from './NetworkDetailsTab';

interface BrowserWalletStepsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletName: string;
  walletIcon?: string;
  onComplete: () => void;
}

export const BrowserWalletStepsModal = ({
  open,
  onOpenChange,
  walletName,
  walletIcon,
  onComplete,
}: BrowserWalletStepsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-xl border-primary/50 max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 rounded-none sm:rounded-lg inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-center text-xl sm:text-xl flex items-center justify-center gap-2">
            {walletIcon && (
              <img
                src={walletIcon}
                alt={walletName}
                className="w-8 h-8 rounded object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            Add RPC to {walletName}
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base pt-2">
            Follow these steps to configure your wallet with Fast Protocol RPC
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0 pt-4">
            <Tabs defaultValue="steps" className="w-full h-full flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="network">Network Details</TabsTrigger>
              </TabsList>
              <TabsContent value="steps" className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col justify-center sm:justify-start">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        1
                      </div>
                      <p className="text-sm text-muted-foreground flex-1">
                        Open your {walletName || 'wallet'} wallet settings
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        2
                      </div>
                      <p className="text-sm text-muted-foreground flex-1">
                        Navigate to Networks or Network Settings
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        3
                      </div>
                      <p className="text-sm text-muted-foreground flex-1">
                        Click &quot;Add Network&quot; or &quot;Add Custom Network&quot;
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        4
                      </div>
                      <p className="text-sm text-muted-foreground flex-1">
                        Enter the network details from the Network Details tab
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border">
                    <div className="relative flex gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground mb-1">
                          Important: Switch to the network after adding
                        </p>
                        <p className="text-sm text-muted-foreground">
                          After adding the network, you may need to switch to it in your wallet
                          before testing.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="network" className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col justify-center sm:justify-start">
                <NetworkDetailsTab />
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex-shrink-0 pt-4 border-t border-border mt-4 -mx-4 sm:mx-0 px-4 sm:px-0">
            <Button className="w-full" onClick={onComplete}>
              <Check className="w-4 h-4 mr-2" />
              Mark as Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

