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
import { Check } from 'lucide-react';

interface MetaMaskToggleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export const MetaMaskToggleModal = ({
  open,
  onOpenChange,
  onComplete,
}: MetaMaskToggleModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-md border-primary/50 max-h-[100vh] sm:max-h-[90vh] flex flex-col m-0 sm:m-4 rounded-none sm:rounded-lg inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Toggle Network</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Switch to FastRPC under Ethereum in MetaMask network settings
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/assets/Toggle-Metamask.gif"
              alt="Toggle MetaMask Network"
              width={300}
              height={200}
              className="rounded-lg"
              unoptimized
            />
          </div>
          <Button className="w-full" onClick={onComplete}>
            <Check className="w-4 h-4 mr-2" />
            Mark as Completed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

