'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check } from 'lucide-react';
import { NetworkDetailsTab } from './NetworkDetailsTab';

interface AddRpcModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletName: string;
  walletIcon?: string;
  isMetaMask: boolean;
  onComplete: () => void;
}

export const AddRpcModal = ({
  open,
  onOpenChange,
  walletName,
  walletIcon,
  isMetaMask,
  onComplete,
}: AddRpcModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-2xl border-primary/50 max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 rounded-none sm:rounded-lg left-0 top-0 sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-center text-xl sm:text-2xl flex items-center justify-center gap-2">
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
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0 pt-4">
            <Tabs defaultValue="network" className="w-full h-full flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="network">Network Details</TabsTrigger>
                <TabsTrigger value="video">Toggle Video</TabsTrigger>
              </TabsList>
              <TabsContent value="network" className="mt-4 flex-1 min-h-0 overflow-y-auto">
                <NetworkDetailsTab />
                <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
                  <Button className="w-full" onClick={onComplete}>
                    <Check className="w-4 h-4 mr-2" />
                    Mark as Completed
                  </Button>
                </div>
              </TabsContent>
              <TabsContent
                value="video"
                className="mt-4 flex-1 min-h-0 overflow-hidden flex items-center justify-center"
              >
                <div className="flex justify-center mb-4">
                  <Image
                    src="/assets/Rabby-Setup.gif"
                    alt="Rabby Setup"
                    width={300}
                    height={200}
                    className="rounded-lg"
                    unoptimized
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

