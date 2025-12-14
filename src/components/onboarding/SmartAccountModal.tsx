'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface SmartAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledged: () => void;
}

/* ----------------------------- Shared Blocks ----------------------------- */

const WhatIsSmartAccount = () => (
  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
    <p className="text-sm font-medium text-foreground">
      What&apos;s a smart account?
    </p>
    <p className="text-sm text-muted-foreground">
      A smart account is a wallet address upgraded to a smart contract, enabling
      advanced features like batching and permissions. Some of these features
      are not fully compatible with Fast RPC.
    </p>
  </div>
);


/* ----------------------------- Main Component ----------------------------- */

export const SmartAccountModal = ({
  open,
  onOpenChange,
  onAcknowledged,
}: SmartAccountModalProps) => {
  const [activeTab, setActiveTab] = useState('warning');

  const getTabMessage = () => {
    if (activeTab === 'check') {
      return 'Requires MetaMask.';
    }
    if (activeTab === 'video') {
      return 'Requires MetaMask and Fast RPC disabled.';
    }
    return null;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        // Prevent closing - user must click "Acknowledged"
        if (!open) return;
      }}
    >
      <DialogContent
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-full h-full sm:h-auto sm:max-w-2xl border-yellow-500/50
          max-h-[100vh] sm:max-h-[90vh]
          flex flex-col m-0 sm:m-4 rounded-none sm:rounded-lg
          left-0 top-0 sm:left-1/2 sm:top-1/2
          translate-x-0 translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2
          p-4 sm:p-6"
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start gap-3 items-center">
            {/* 1. Icon Container */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>

            {/* 2. Text Column (Added justify-start) */}
            <div className="flex flex-col">
              <DialogTitle>Smart Account Information</DialogTitle>
              {getTabMessage() && (
                <div className="flex items-center gap-1 mt-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {getTabMessage()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-4">
          <Tabs defaultValue="warning" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-3 flex-shrink-0">
              <TabsTrigger value="warning">Why this matters</TabsTrigger><TabsTrigger value="check">Check</TabsTrigger><TabsTrigger value="video" className="flex items-center gap-2">
                Disable
                <Badge
                  variant="secondary"
                  className="text-[12px] px-1.5 py-0 h-4"
                >
                  Optional
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Warning Tab */}
            <TabsContent
              value="warning"
              className="mt-4 flex-1 overflow-y-auto space-y-4"
            >
              <WhatIsSmartAccount />

              <p className="text-sm text-muted-foreground text-center">
                Ensure that your wallet is not a smart account.
              </p>
            </TabsContent>

            {/* Check Tab */}
            <TabsContent
              value="check"
              className="mt-4 flex-1 overflow-hidden flex flex-col items-center gap-4"
            >
              <div className="flex justify-center mb-4">
                <Image
                  src="/assets/smart-check.gif"
                  alt="Smart Check"
                  width={300}
                  height={200}
                  className="rounded-lg"
                  unoptimized
                />
              </div>
            </TabsContent>

            {/* Video Tab */}
            <TabsContent
              value="video"
              className="mt-4 flex-1 overflow-hidden flex flex-col items-center gap-4"
            >
              <div className="flex justify-center mb-4">
                <Image
                  src="/assets/smart-disable.gif"
                  alt="Smart Disable"
                  width={300}
                  height={200}
                  className="rounded-lg"
                  unoptimized
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex-shrink-0  border-t border-border">
            <Button onClick={onAcknowledged} className="w-full">
              Acknowledged
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
