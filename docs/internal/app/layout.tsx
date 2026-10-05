import { RootProvider } from 'fumadocs-ui/provider/next';

import type { ReactNode } from 'react';

import './global.css';

export const metadata = {
  title: { default: 'Time Manager Internal Docs', template: '%s | Time Manager Internal' },
  description: 'Engineering, operations and platform documentation for the Time Manager team.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: 'static', api: '/internal/api/search' } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
