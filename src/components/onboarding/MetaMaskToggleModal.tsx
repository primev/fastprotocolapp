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
      <DialogContent className="sm:max-w-md border-primary/50">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Toggle Network</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Switch to Fast Protocol network in MetaMask
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

