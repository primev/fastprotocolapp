'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';

interface WalletWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
}

export const WalletWarningModal = ({
  open,
  onAcknowledge,
}: WalletWarningModalProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        // Prevent closing - user must click "I Understand"
        if (!open) return;
      }}
    >
      <DialogContent
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-full h-full sm:h-auto sm:max-w-2xl border-primary/50 max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 rounded-none sm:rounded-lg left-0 top-0 sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Wallet Warning</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0 pt-4">
            <Tabs defaultValue="warning" className="w-full h-full flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="warning">Warning</TabsTrigger>
                <TabsTrigger value="steps">Steps</TabsTrigger>
              </TabsList>
              <TabsContent value="warning" className="mt-4 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-yellow-600 mb-2">Multiple Wallets</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          If you have multiple wallet extensions installed, you may experience
                          unexpected behavior during wallet connections and transactions.
                        </p>
                        <br />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          It is recommended to temporarily disable other wallet extensions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="steps" className="mt-4 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">
                    How to disable wallet extensions:
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside ml-2">
                    <li>Click the puzzle icon in your browser toolbar</li>
                    <li>Find the wallet extensions you want to temporarily disable</li>
                    <li>Toggle them off or click &quot;Remove&quot; (you can add them back later)</li>
                    <li>Return here and proceed with connecting your wallet</li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
            <Button className="w-full" onClick={onAcknowledge}>
              I Understand
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

