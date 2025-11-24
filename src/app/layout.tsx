import '@/app/globals.css';

import type { Metadata } from 'next';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fastprotocol.app'
  ),
  title: 'Fast Protocol - Lightning-fast transactions on L1',
  description:
    'Lightning-fast transactions on L1. Tokenized mev rewards. Join the waitlist for exclusive early access to Fast Protocol.',
  icons: { icon: '/icon.png' },
  viewport: { width: 'device-width', initialScale: 1 },
  keywords: [
    'blockchain',
    'protocol',
    'crypto',
    'fast transactions',
    'L1',
    'mev rewards',
    'web3',
  ],
  authors: [{ name: 'Fast Protocol' }],
  openGraph: {
    title: 'Fast Protocol - Lightning-fast transactions on L1',
    description: 'Lightning-fast transactions on L1. Tokenized mev rewards.',
    url: '/',
    type: 'website',
    images: [
      {
        url: 'https://lovable.dev/opengraph-image-p98pqg.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Fast_Protocol',
    title: 'Fast Protocol - Lightning-fast transactions on L1',
    description: 'Lightning-fast transactions on L1. Tokenized mev rewards.',
    images: ['https://lovable.dev/opengraph-image-p98pqg.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth overflow-x-hidden">
      <body className="overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
