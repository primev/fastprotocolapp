'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export const OnboardingHeader = () => {
  const router = useRouter();

  return (
    <header className="border-b border-border/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="relative">
          <Image
            src="/assets/fast-icon.png"
            alt="Fast Protocol"
            width={40}
            height={40}
            className="sm:hidden"
          />
          <Image
            src="/assets/fast-protocol-logo-icon.png"
            alt="Fast Protocol"
            width={150}
            height={150}
            className="hidden sm:block"
          />
        </div>
        <Button variant="outline" onClick={() => router.push('/claim')} className="gap-2">
          <Home className="w-4 h-4" />
          Return to Home
        </Button>
      </div>
    </header>
  );
};

