'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useRPCTest } from '@/hooks/use-rpc-test';
import { FAST_PROTOCOL_NETWORK } from '@/lib/network-config';

interface RPCTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function RPCTestModal({
  open,
  onOpenChange,
  onConfirm,
  onClose,
}: RPCTestModalProps) {
  const rpcTest = useRPCTest();

  // Reset state when modal opens to clear any previous test results
  useEffect(() => {
    if (open) {
      rpcTest.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      rpcTest.reset();
      onClose();
    } else if (!rpcTest.isTesting) {
      onOpenChange(isOpen);
    }
  };

  const handleConfirmTest = () => {
    rpcTest.test();
    onConfirm();
  };

  const handleClose = () => {
    rpcTest.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/50" hideClose>
        {rpcTest.testResult ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${rpcTest.testResult.success
                    ? 'bg-green-500/10'
                    : 'bg-destructive/10'
                  }`}>
                  {rpcTest.testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <DialogTitle>
                  {rpcTest.testResult.success ? 'Test Successful' : 'Test Failed'}
                </DialogTitle>
              </div>
              <div className="text-left pt-2 space-y-4">
                <DialogDescription>
                  {rpcTest.testResult.success ? (
                    'Fast Protocol RPC connection was successfully verified.'
                  ) : (
                    'The RPC connection test failed. Please check your configuration and try again.'
                  )}
                </DialogDescription>
                {rpcTest.testResult.hash && (
                  <div className="pt-2">
                    <a
                      href={`${FAST_PROTOCOL_NETWORK.blockExplorerUrls[0]}tx/${rpcTest.testResult.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      View transaction on Etherscan
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={handleClose}
                className="w-full"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <AlertCircle className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle>RPC Connection Test</DialogTitle>
              </div>
              <div className="text-left pt-2 space-y-4">
                <DialogDescription>
                  To verify that your RPC is properly configured, a test transaction will be performed.
                </DialogDescription>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Transaction Details:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Zero value transaction (0 ETH)</li>
                    <li>No funds will be transferred</li>
                    <li>Only verifies RPC connectivity</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  You will need to approve this transaction in your wallet to complete the test.
                </p>
              </div>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={rpcTest.isTesting}
              >
                Skip
              </Button>
              <Button
                onClick={handleConfirmTest}
                disabled={rpcTest.isTesting}
                className="flex items-center gap-2"
              >
                {rpcTest.isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
                {rpcTest.isTesting ? "Testing..." : "Perform Test"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
