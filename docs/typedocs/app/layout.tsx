import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

import './global.css';

export const metadata = {
  title: { default: 'Time Manager API - Code Reference', template: '%s | Time Manager API' },
  description: 'TypeDoc code reference for the Time Manager API.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: 'static', api: '/typedocs/api/search' } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
