'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Twitter, Check } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';

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
  const { toast } = useToast();

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

    setTimeout(() => {
      toast({
        title: 'Success!',
        description: "You've been added to the waitlist",
      });
      setIsSuccess(true);
      setTimeout(() => {
        setEmail('');
        setIsLoading(false);
        setIsSuccess(false);
      }, 2000);
    }, 1000);
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 -mt-[40vh]">
        <div className="max-w-3xl mx-auto space-y-1 text-center">
          {/* Logo */}
          <div className="flex justify-center -mb-16">
            <img
              src={'/assets/fast-protocol-logo-icon.png'}
              alt="Fast Protocol"
              className="h-56 md:h-72 w-auto"
              style={{ clipPath: 'inset(10% 0 30% 0)' }}
            />
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground -mt-6 mb-8">
            Lightning-fast transactions on L1. Tokenized mev rewards.
          </p>

          {/* Email Signup */}
          <div className="backdrop-blur-sm bg-card/60 border border-primary/20 rounded-2xl p-3 md:p-4 shadow-xl max-w-xl mx-auto mt-[10vh]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 bg-background/50 border-primary/30 focus:border-primary"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={isLoading}
                  className="h-12 px-8 whitespace-nowrap"
                >
                  {isSuccess ? (
                    <Check className="w-6 h-6 text-green-500 animate-scale-in" />
                  ) : isLoading ? (
                    'Claiming...'
                  ) : (
                    'Claim Fast Pass'
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Social Links */}
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Button key={social.name} variant="glass" size="lg" asChild>
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
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pb-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>Built by</span>
          <img
            src={'/assets/primev-logo.png'}
            alt="Primev"
            className="h-6 opacity-80"
          />
          <span className="mx-2">•</span>
          <span>Backed by</span>
          <img
            src={'/assets/a16z-logo.webp'}
            alt="a16z"
            className="h-6 opacity-60 hover:opacity-100 transition-opacity"
          />
          <img
            src={'/assets/bodhi-logo.webp'}
            alt="Bodhi Ventures"
            className="h-4 opacity-60 hover:opacity-100 transition-opacity"
          />
          <img
            src={'/assets/figment-logo.webp'}
            alt="Figment"
            className="h-9 opacity-60 hover:opacity-100 transition-opacity"
          />
          <img
            src={'/assets/hashkey-logo.svg'}
            alt="HashKey"
            className="h-6 opacity-60 hover:opacity-100 transition-opacity"
          />
          <img
            src={'/assets/longhash-logo.webp'}
            alt="LongHash Ventures"
            className="h-24 opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
};

export default IndexPage;
