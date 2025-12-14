'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export const OnboardingHeader = () => {
  const router = useRouter();

  return (
    <header className="border-b border-border/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 lg:py-3 flex items-center justify-between">
        <div className="relative">
          <Image
            src="/assets/fast-icon.png"
            alt="Fast Protocol"
            width={40}
            height={40}
            className="sm:hidden cursor-pointer"
            onClick={() => router.push('/claim')}
          />
          <Image
            src="/assets/fast-protocol-logo-icon.png"
            alt="Fast Protocol"
            width={150}
            height={150}
            className="hidden sm:block cursor-pointer"
            onClick={() => router.push('/claim')}
          />
        </div>
       
        <h1 className="text-muted-foreground font-bold">  Claim Genesis SBT</h1>
      </div>
    </header>
  );
};

