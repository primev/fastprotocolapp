"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface SBTGatingModalProps {
  open: boolean;
  onClose?: () => void;
}

export const SBTGatingModal = ({ open, onClose }: SBTGatingModalProps) => {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()} modal>
      <DialogContent className="sm:max-w-md border-primary/50 glow-border">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center glow-border">
              <Award className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Fast Genesis SBT Required</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            You must mint your Genesis SBT to access the Fast Points System and Season 1 leaderboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => router.push("/claim/onboarding")}
          >
            Mint Genesis SBT
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open("https://docs.fast.xyz/genesis-sbt", "_blank")}
          >
            Learn More
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

