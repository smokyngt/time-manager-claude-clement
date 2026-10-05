import { RootProvider } from 'fumadocs-ui/provider/next';
import { ui } from '@/lib/ui';

import type { ReactNode } from 'react';

import '@/app/global.css';

export function RootShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider i18n={ui.provider(lang)} search={{ options: { type: 'static' } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
