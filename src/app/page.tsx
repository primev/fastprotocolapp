'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { captureEmailAction } from '@/actions/capture-email';
import { MessageCircle, Send, Twitter, Check, HelpCircle } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import type { CaptureEmailResult } from '@/lib/email';
import { useAddFastToMetamask } from '@/hooks/use-add-fast-to-metamask';

const socialLinks = [
  {
    name: 'Discord',
    icon: MessageCircle,
    url: 'https://discord.gg/fastprotocol',
  },
  {
    name: 'Telegram',
    icon: Send,
    url: 'https://t.me/Fast_Protocol',
  },
  {
    name: 'Twitter',
    icon: Twitter,
    url: 'https://x.com/Fast_Protocol',
  },
];

const IndexPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [rpcAdded, setRpcAdded] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isProcessing, addFastToMetamask } = useAddFastToMetamask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const result: CaptureEmailResult = await captureEmailAction({ email });
      if (result.alreadySubscribed) {
        toast({
          title: "You're already subscribed!",
        });
      } else {
        toast({
          title: 'Success!',
          description: "You've been added to the waitlist",
        });
        setIsSuccess(true);
        setTimeout(() => {
          setEmail('');
          setIsSuccess(false);
        }, 2000);
      }
    } catch (err) {
      // Log detailed error for debugging, do not expose details in UI
      // eslint-disable-next-line no-console
      console.error('Failed to capture email', err);
      toast({
        title: 'Something went wrong',
        description: 'We could not add your email right now. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 -mt-[40vh]">
        <div className="max-w-3xl mx-auto space-y-6 text-center">
          {/* Logo */}
          <div className="flex justify-center -mb-16">
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={512}
              height={512}
              priority
              className="h-56 md:h-72 lg:h-80 w-auto"
              style={{ clipPath: 'inset(10% 0 30% 0)' }}
            />
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Lightning-fast transactions on L1. Tokenized mev rewards.
          </p>

          {/* Email Signup */}
          <div className="backdrop-blur-sm bg-card/60 border border-primary/20 rounded-2xl p-3 md:p-4 shadow-xl max-w-xl lg:max-w-3xl mx-auto mt-[10vh]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 bg-background/50 border-primary/30 focus:border-primary lg:text-base"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={isLoading}
                  className="h-12 px-8 whitespace-nowrap lg:text-base"
                >
                  {isSuccess ? (
                    <Check className="w-6 h-6 text-green-500 animate-scale-in" />
                  ) : isLoading ? (
                    'Joining...'
                  ) : (
                    'Join Waitlist'
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Social Links */}
          <div className="flex flex-wrap gap-3 justify-center">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Button
                  key={social.name}
                  variant="glass"
                  size="lg"
                  asChild
                  className="lg:text-base"
                >
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{social.name}</span>
                  </a>
                </Button>
              );
            })}
          </div>

          {/* Add RPC Button */}
          <div className="flex flex-col items-center pt-10 space-y-3">
            <Button 
              variant="glass"
              size="lg"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const success = await addFastToMetamask();
                if (success) {
                  setRpcAdded(true);
                  setTimeout(() => {
                    setRpcAdded(false);
                  }, 3000);
                }
              }}
              disabled={isProcessing || rpcAdded}
              className="h-12 px-8 lg:text-base border-2 border-primary/20"
            >
              {rpcAdded ? '✓ Added Successfully!' : isProcessing ? 'Processing...' : 'Add Fast RPC to MetaMask'}
            </Button>
            <button
              onClick={() => setIsHelpDialogOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 underline underline-offset-4"
            >
              Need Help?
            </button>
          </div>

          {/* Help Dialog */}
          <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adding Fast RPC to MetaMask</DialogTitle>
                <DialogDescription className="pt-4 space-y-3">
                  <p>
                    To properly add the Fast RPC network to MetaMask, you need to manually disconnect all other wallet extensions first.
                  </p>
                  <div className="space-y-2 pt-2">
                    <p className="font-medium text-foreground">Steps to follow:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-left pl-2">
                      <li>Open your browser extensions (click the puzzle icon in your browser toolbar)</li>
                      <li>Disconnect or disable any other wallet extensions (Rabby, Coinbase Wallet, etc.)</li>
                      <li>Make sure only MetaMask is active</li>
                      <li>Return to this page and click "Add Fast RPC to MetaMask"</li>
                    </ol>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    This is necessary because multiple wallet extensions can interfere with the network addition process.
                  </p>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pb-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Built by</span>
            <Image
              src="/assets/primev-logo.png"
              alt="Primev"
              width={100}
              height={24}
              className="h-6 opacity-80"
            />
          </div>
          <span className="mx-2">•</span>

          <span>Backed by</span>
          <Image
            src="/assets/a16z-logo.webp"
            alt="a16z"
            width={177}
            height={24}
            className="h-6 opacity-60 hover:opacity-100 transition-opacity"
          />
          <Image
            src="/assets/bodhi-logo.webp"
            alt="Bodhi Ventures"
            width={170}
            height={16}
            className="h-4 opacity-60 hover:opacity-100 transition-opacity"
          />
          <Image
            src="/assets/figment-logo.webp"
            alt="Figment"
            width={96}
            height={36}
            className="h-9 opacity-60 hover:opacity-100 transition-opacity"
          />
          <Image
            src="/assets/hashkey-logo.svg"
            alt="HashKey"
            width={73}
            height={24}
            className="h-6 opacity-60 hover:opacity-100 transition-opacity"
          />
          <Image
            src="/assets/longhash-logo.png"
            alt="LongHash Ventures"
            width={96}
            height={32}
            className="opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
};

export default IndexPage;
