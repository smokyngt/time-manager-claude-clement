import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';
import { ui } from '@/lib/ui';

import type { ReactNode } from 'react';

import '@/app/global.css';

const inter = Inter({ subsets: ['latin'] });

export function RootShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang} className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider i18n={ui.provider(lang)} search={{ options: { type: 'static' } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
