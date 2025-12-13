'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, XCircle } from 'lucide-react';

interface SmartAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMetaMask: boolean;
  onNotComplete: () => void;
  onComplete: () => void;
  onClose: () => void;
}

export const SmartAccountModal = ({
  open,
  onOpenChange,
  isMetaMask,
  onNotComplete,
  onComplete,
  onClose,
}: SmartAccountModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={`w-full h-full sm:h-auto ${
          isMetaMask ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } border-primary/50 max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 rounded-none sm:rounded-lg left-0 top-0 sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6`}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Smart Account Detected</DialogTitle>
          </div>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {isMetaMask ? (
            <div className="flex-1 min-h-0 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0 pt-4">
              <Tabs defaultValue="warning" className="w-full h-full flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                  <TabsTrigger value="warning">Warning</TabsTrigger>
                  <TabsTrigger value="video">Toggle Video</TabsTrigger>
                </TabsList>
                <TabsContent value="warning" className="mt-4 flex-1 min-h-0 overflow-y-auto">
                  <div className="text-left space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium text-foreground">What&apos;s a smart account?</p>
                      <p className="text-sm text-muted-foreground">
                        A smart account is a wallet address that&apos;s been upgraded to a smart contract
                        (for example via EIP-7702). These wallets add extra features, but they can&apos;t
                        mint the Genesis SBT.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Try switching to a standard wallet to continue.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent
                  value="video"
                  className="mt-4 flex-1 min-h-0 overflow-hidden flex items-center justify-center"
                >
                  <div className="w-full h-full max-w-full max-h-full rounded-lg overflow-hidden flex justify-center items-center p-2">
                    <Image
                      src="/assets/metamask-smart-account-toggle.gif"
                      alt="Toggle MetaMask Smart Account"
                      width={800}
                      height={600}
                      className="rounded-lg object-contain w-auto h-auto"
                      style={{ maxHeight: '100%', maxWidth: '100%' }}
                      unoptimized
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pt-4">
              <div className="text-left space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">What&apos;s a smart account?</p>
                  <p className="text-sm text-muted-foreground">
                    A smart account is a wallet address that&apos;s been upgraded to a smart contract
                    (for example via EIP-7702). These wallets add extra features, but they can&apos;t
                    mint the Genesis SBT.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Try switching to a standard wallet to continue.
                </p>
              </div>
            </div>
          )}
          <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
            {isMetaMask ? (
              <div className="flex gap-3">
                <Button variant="outline" onClick={onNotComplete} className="flex-1">
                  Not Complete
                </Button>
                <Button onClick={onComplete} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Complete
                </Button>
              </div>
            ) : (
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

