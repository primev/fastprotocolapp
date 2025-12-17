'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAffiliateCode } from '@/hooks/use-affiliate-code';
import { DialogFooter } from '@/components/ui/dialog';

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferralModal({
  open,
  onOpenChange,
}: ReferralModalProps) {
  const [codeInput, setCodeInput] = useState('');
  const [codeAvailability, setCodeAvailability] = useState<boolean | null>(null);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);

  // Use affiliate code hook
  const {
    affiliateCode,
    isCreatingCode,
    isCheckingCode,
    checkCodeAvailability,
    createAffiliateCode: createCode,
    updateAffiliateCode: updateCode,
  } = useAffiliateCode();

  // Reset form state when modal closes
  useEffect(() => {
    if (!open) {
      setCodeInput('');
      setCodeAvailability(null);
      setHasCheckedAvailability(false);
    }
  }, [open]);

  const handleCheckAvailability = async () => {
    if (!codeInput.trim()) {
      toast.error('Please enter a code to check');
      return;
    }
    
    setHasCheckedAvailability(false);
    setCodeAvailability(null);
    const isAvailable = await checkCodeAvailability(codeInput.trim());
    setCodeAvailability(isAvailable);
    setHasCheckedAvailability(true);
    
    if (isAvailable) {
      toast.success('Code is available!');
    } else {
      toast.error('Code is already taken');
    }
  };

  const handleCreateAffiliateCode = async () => {
    const success = await createCode(codeInput.trim());
    if (success) {
      setCodeInput('');
      setCodeAvailability(null);
      setHasCheckedAvailability(false);
      onOpenChange(false);
    }
  };

  const handleUpdateAffiliateCode = async () => {
    const success = await updateCode(codeInput.trim());
    if (success) {
      setCodeInput('');
      setCodeAvailability(null);
      setHasCheckedAvailability(false);
      onOpenChange(false);
    }
  };

  // Reset availability check when code input changes
  const handleCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCodeInput(e.target.value);
    setCodeAvailability(null);
    setHasCheckedAvailability(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setCodeInput('');
        setCodeAvailability(null);
        setHasCheckedAvailability(false);
      }
      onOpenChange(isOpen);
    }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="mb-4">{affiliateCode ? 'Update Affiliate Code' : 'Create Affiliate Code'}</DialogTitle>
            <DialogDescription>
              Create a custom code to make your referral link more memorable. Codes can only contain letters, numbers, and dashes (max 30 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code-input">Affiliate Code</Label>
              <div className="flex gap-2">
                <Input
                  id="code-input"
                  value={codeInput}
                  onChange={handleCodeInputChange}
                  maxLength={30}
                  disabled={isCreatingCode || isCheckingCode}
                  className="flex-1"
                  tabIndex={-1} // Prevent auto-focus when dialog opens
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCheckAvailability}
                  disabled={!codeInput.trim() || isCreatingCode || isCheckingCode || codeInput.trim() === affiliateCode}
                  title="Check if code is available"
                >
                  {isCheckingCode ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* Availability Status */}
              {hasCheckedAvailability && codeAvailability !== null && (
                <div className={`flex items-center gap-2 text-xs ${
                  codeAvailability ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {codeAvailability ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Code is available</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3" />
                      <span>Code is already taken</span>
                    </>
                  )}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mb-4">
                You'll need to sign a message to {affiliateCode ? 'update' : 'create'} your code.
              </p>
            </div>
            <DialogFooter className="flex gap-3">
              <Button
                className="flex-1"
                onClick={affiliateCode ? handleUpdateAffiliateCode : handleCreateAffiliateCode}
                disabled={!codeInput.trim() || isCreatingCode || (hasCheckedAvailability && !codeAvailability)}
              >
                {isCreatingCode ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {affiliateCode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  affiliateCode ? 'Update Code' : 'Create Code'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCodeInput('');
                  setCodeAvailability(null);
                  setHasCheckedAvailability(false);
                  onOpenChange(false);
                }}
                disabled={isCreatingCode}
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
  );
}
