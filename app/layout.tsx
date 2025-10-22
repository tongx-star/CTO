import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Press_Start_2P } from 'next/font/google';

const pressStart = Press_Start_2P({ subsets: ['latin'], weight: '400' });

export const metadata: Metadata = {
  title: 'Pixel Tank Battle',
  description: 'Retro-inspired tank battle in the browser built with Next.js'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${pressStart.className} bg-surface text-foreground`}>{children}</body>
    </html>
  );
}
